import { Marker, MarkerType } from '@/types/marker';
import NetInfo from '@react-native-community/netinfo';
import {
  deleteSOSMarker,
  getActiveSOSMarkers,
  getAllMarkers,
  getUnsyncedMarkers,
  getUnsyncedSOSMarkers,
  getUnsyncedSOSResponses,
  markMarkerAsSynced,
  markSOSMarkerAsSynced,
  markSOSResponseAsSynced,
  upsertMarker,
  upsertSOSMarker,
  upsertSOSResponse,
} from './database';
import { isSupabaseConfigured, supabase, SupabaseMarker, SupabaseSOSMarker, SupabaseSOSResponse } from './supabase';

let syncInterval: ReturnType<typeof setInterval> | null = null;
let isCurrentlySyncing = false;

// Distance threshold for considering markers as duplicates (in meters)
const DUPLICATE_DISTANCE_THRESHOLD = 50;

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Find if a similar marker exists in the cloud
 * Returns the existing marker if found, null otherwise
 */
async function findSimilarMarkerInCloud(
  marker: Marker
): Promise<SupabaseMarker | null> {
  if (!supabase) return null;

  try {
    // Get all markers of the same type from cloud
    const { data, error } = await supabase
      .from('markers')
      .select('*')
      .eq('type', marker.type);

    if (error || !data) return null;

    // Check each marker for proximity
    for (const cloudMarker of data) {
      const distance = calculateDistance(
        marker.latitude,
        marker.longitude,
        cloudMarker.latitude,
        cloudMarker.longitude
      );

      // If within threshold distance, consider it a duplicate
      if (distance <= DUPLICATE_DISTANCE_THRESHOLD) {
        console.log(`🔍 Found similar marker within ${distance.toFixed(0)}m:`, cloudMarker.id);
        return cloudMarker;
      }
    }

    return null;
  } catch (error) {
    console.error('Error checking for similar markers:', error);
    return null;
  }
}

/**
 * Start the sync service
 * Monitors connectivity and syncs when online
 */
export function startSyncService(): void {
  if (!isSupabaseConfigured) {
    console.log('📡 Sync service disabled - Supabase not configured');
    return;
  }

  console.log('📡 Starting sync service...');

  // Monitor network connectivity
  NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable) {
      console.log('🌐 Network connected - triggering sync');
      performSync();
    } else {
      console.log('📴 Network disconnected - sync paused');
    }
  });

  // Periodic sync every 30 seconds when online
  syncInterval = setInterval(() => {
    NetInfo.fetch().then(state => {
      if (state.isConnected && state.isInternetReachable) {
        performSync();
      }
    });
  }, 30000); // 30 seconds

  // Initial sync
  NetInfo.fetch().then(state => {
    if (state.isConnected && state.isInternetReachable) {
      performSync();
    }
  });

  // Subscribe to real-time updates from Supabase
  subscribeToRealtimeUpdates();
  subscribeToSOSRealtimeUpdates();
}

/**
 * Stop the sync service
 */
export function stopSyncService(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  console.log('🛑 Sync service stopped');
}

/**
 * Perform a full sync cycle
 */
async function performSync(): Promise<void> {
  if (!supabase || isCurrentlySyncing) return;

  isCurrentlySyncing = true;
  console.log('🔄 Starting sync...');

  try {
    // 1. Push unsynced local markers to cloud
    await pushLocalMarkersToCloud();

    // 2. Pull new markers from cloud to local
    await pullCloudMarkersToLocal();

    // 3. Push unsynced SOS markers to cloud
    await pushSOSMarkersToCloud();

    // 4. Push unsynced SOS responses to cloud
    await pushSOSResponsesToCloud();

    // 5. Pull SOS markers from cloud
    await pullSOSMarkersFromCloud();

    // 6. Pull SOS responses from cloud
    await pullSOSResponsesFromCloud();

    console.log('✅ Sync completed successfully');
  } catch (error) {
    console.error('❌ Sync error:', error);
  } finally {
    isCurrentlySyncing = false;
  }
}

/**
 * Push unsynced local markers to Supabase
 * Includes spatial deduplication to prevent duplicate markers at same location
 */
async function pushLocalMarkersToCloud(): Promise<void> {
  if (!supabase) return;

  const unsyncedMarkers = await getUnsyncedMarkers();

  if (unsyncedMarkers.length === 0) {
    console.log('📤 No markers to push');
    return;
  }

  console.log(`📤 Pushing ${unsyncedMarkers.length} markers to cloud...`);

  for (const marker of unsyncedMarkers) {
    try {
      // Check if a similar marker already exists in the cloud
      const existingMarker = await findSimilarMarkerInCloud(marker);

      if (existingMarker) {
        // Similar marker found - merge instead of creating duplicate
        console.log(`🔀 Merging marker ${marker.id} into existing ${existingMarker.id}`);
        
        // Merge vote counts
        const mergedAgrees = existingMarker.agrees + marker.agrees;
        const mergedDisagrees = existingMarker.disagrees + marker.disagrees;
        const totalVotes = mergedAgrees + mergedDisagrees;
        const mergedConfidenceScore = Math.round((mergedAgrees / totalVotes) * 100);

        // Update the existing marker with merged data
        const { error: updateError } = await supabase
          .from('markers')
          .update({
            agrees: mergedAgrees,
            disagrees: mergedDisagrees,
            confidence_score: mergedConfidenceScore,
            last_verified: Math.max(existingMarker.last_verified, marker.lastVerified),
            // Keep the better description (longer or existing)
            description: marker.description && marker.description.length > (existingMarker.description?.length || 0)
              ? marker.description
              : existingMarker.description,
          })
          .eq('id', existingMarker.id);

        if (updateError) {
          console.error('❌ Error merging marker:', updateError);
        } else {
          // Mark local marker as synced (merged)
          await markMarkerAsSynced(marker.id);
          console.log(`✅ Merged marker ${marker.id} → ${existingMarker.id}`);
        }
      } else {
        // No similar marker found - create new one
        const supabaseMarker: SupabaseMarker = {
          id: marker.id,
          type: marker.type,
          latitude: marker.latitude,
          longitude: marker.longitude,
          title: marker.title,
          description: marker.description || null,
          created_by: marker.createdBy,
          created_at: marker.createdAt,
          last_verified: marker.lastVerified,
          agrees: marker.agrees,
          disagrees: marker.disagrees,
          confidence_score: marker.confidenceScore,
        };

        const { error } = await supabase
          .from('markers')
          .upsert(supabaseMarker, { onConflict: 'id' });

        if (error) {
          console.error('❌ Error pushing marker:', marker.id, error);
        } else {
          await markMarkerAsSynced(marker.id);
          console.log('✅ Pushed new marker:', marker.id);
        }
      }
    } catch (error) {
      console.error('❌ Error pushing marker:', marker.id, error);
    }
  }
}

/**
 * Pull new markers from Supabase to local database
 */
async function pullCloudMarkersToLocal(): Promise<void> {
  if (!supabase) return;

  try {
    // Get the timestamp of our most recent local marker
    const localMarkers = await getAllMarkers();
    const mostRecentTimestamp = localMarkers.length > 0
      ? Math.max(...localMarkers.map(m => m.createdAt))
      : 0;

    console.log(`📥 Pulling markers newer than ${new Date(mostRecentTimestamp).toISOString()}...`);

    // Fetch markers from cloud that are newer than our most recent
    const { data, error } = await supabase
      .from('markers')
      .select('*')
      .gt('created_at', mostRecentTimestamp)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error pulling markers:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('📥 No new markers to pull');
      return;
    }

    console.log(`📥 Pulled ${data.length} new markers from cloud`);

    // Insert markers into local database
    for (const cloudMarker of data) {
      const marker: Marker = {
        id: cloudMarker.id,
        type: cloudMarker.type as MarkerType,
        latitude: cloudMarker.latitude,
        longitude: cloudMarker.longitude,
        title: cloudMarker.title,
        description: cloudMarker.description || '',
        createdBy: cloudMarker.created_by,
        createdAt: cloudMarker.created_at,
        lastVerified: cloudMarker.last_verified,
        agrees: cloudMarker.agrees,
        disagrees: cloudMarker.disagrees,
        confidenceScore: cloudMarker.confidence_score,
        syncedToServer: true,
      };

      await upsertMarker(marker);
    }

    console.log('✅ Cloud markers synced to local database');
  } catch (error) {
    console.error('❌ Error pulling markers from cloud:', error);
  }
}

/**
 * Subscribe to real-time updates from Supabase
 */
function subscribeToRealtimeUpdates(): void {
  if (!supabase) return;

  console.log('🔔 Subscribing to real-time updates...');

  supabase
    .channel('markers_changes')
    .on(
      'postgres_changes',
      {
        event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
        schema: 'public',
        table: 'markers',
      },
      (payload) => {
        console.log('🔔 Real-time update received:', payload.eventType);
        
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const cloudMarker = payload.new as SupabaseMarker;
          
          const marker: Marker = {
            id: cloudMarker.id,
            type: cloudMarker.type as MarkerType,
            latitude: cloudMarker.latitude,
            longitude: cloudMarker.longitude,
            title: cloudMarker.title,
            description: cloudMarker.description || '',
            createdBy: cloudMarker.created_by,
            createdAt: cloudMarker.created_at,
            lastVerified: cloudMarker.last_verified,
            agrees: cloudMarker.agrees,
            disagrees: cloudMarker.disagrees,
            confidenceScore: cloudMarker.confidence_score,
            syncedToServer: true,
          };

          // Update local database with real-time change
          upsertMarker(marker).then(() => {
            console.log('✅ Real-time marker synced to local DB:', marker.id);
          });
        }
      }
    )
    .subscribe();
}

/**
 * Manually trigger a sync (for pull-to-refresh)
 */
export async function manualSync(): Promise<void> {
  const state = await NetInfo.fetch();
  
  if (!state.isConnected || !state.isInternetReachable) {
    throw new Error('No internet connection');
  }

  await performSync();
}

// ============================================================================
// SOS SYNC FUNCTIONS
// ============================================================================

/**
 * Push unsynced SOS markers to Supabase
 */
async function pushSOSMarkersToCloud(): Promise<void> {
  if (!supabase) return;

  const unsyncedSOS = await getUnsyncedSOSMarkers();

  if (unsyncedSOS.length === 0) {
    console.log('📤 No SOS markers to push');
    return;
  }

  console.log(`📤 Pushing ${unsyncedSOS.length} SOS markers to cloud...`, 
    unsyncedSOS.map(s => `${s.id.substring(0, 12)}:${s.status}`).join(', '));

  for (const sos of unsyncedSOS) {
    try {
      // Push SOS marker to cloud (without completed_at field)
      const supabaseSOS: SupabaseSOSMarker = {
        id: sos.id,
        latitude: sos.latitude,
        longitude: sos.longitude,
        created_by: sos.created_by,
        created_at: sos.created_at,
        status: sos.status,
        expires_at: sos.expires_at || null,
      };

      const { error } = await supabase
        .from('sos_markers')
        .upsert(supabaseSOS, { onConflict: 'id' });

      if (error) {
        console.error('❌ Error pushing SOS marker:', sos.id, error);
      } else {
        await markSOSMarkerAsSynced(sos.id);
        console.log('✅ Pushed SOS marker:', sos.id);
      }
    } catch (error) {
      console.error('❌ Error pushing SOS marker:', sos.id, error);
    }
  }
}

/**
 * Push unsynced SOS responses to Supabase
 */
async function pushSOSResponsesToCloud(): Promise<void> {
  if (!supabase) return;

  const unsyncedResponses = await getUnsyncedSOSResponses();

  if (unsyncedResponses.length === 0) {
    return;
  }

  console.log(`📤 Pushing ${unsyncedResponses.length} SOS responses to cloud...`);

  for (const response of unsyncedResponses) {
    try {
      const supabaseResponse: Omit<SupabaseSOSResponse, 'id'> = {
        sos_marker_id: response.sos_marker_id,
        responder_device_id: response.responder_device_id,
        created_at: response.created_at,
        updated_at: response.updated_at,
        current_latitude: response.current_latitude,
        current_longitude: response.current_longitude,
        distance_meters: response.distance_meters,
        eta_minutes: response.eta_minutes,
        status: response.status,
      };

      const { error } = await supabase
        .from('sos_responses')
        .upsert({ ...supabaseResponse, id: response.id }, { onConflict: 'id' });

      if (error) {
        console.error('❌ Error pushing SOS response:', response.id, error);
      } else {
        await markSOSResponseAsSynced(response.id);
        console.log('✅ Pushed SOS response:', response.id);
      }
    } catch (error) {
      console.error('❌ Error pushing SOS response:', response.id, error);
    }
  }
}

/**
 * Pull SOS markers from cloud
 */
async function pullSOSMarkersFromCloud(): Promise<void> {
  if (!supabase) return;

  try {
    // Pull active SOS markers from the last 24 hours
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    const { data: activeData, error: activeError } = await supabase
      .from('sos_markers')
      .select('*')
      .eq('status', 'active')
      .gt('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false });

    if (activeError) {
      console.error('❌ Error pulling active SOS markers:', activeError);
      return;
    }

    if (activeData && activeData.length > 0) {
      console.log(`📥 Pulled ${activeData.length} active SOS markers from cloud`);
      for (const cloudSOS of activeData) {
        await upsertSOSMarker(cloudSOS);
      }
    }

    // Also pull recently completed markers (last 24 hours) to clean up local DB
    const { data: completedData, error: completedError } = await supabase
      .from('sos_markers')
      .select('*')
      .eq('status', 'completed')
      .gt('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false });

    if (!completedError && completedData && completedData.length > 0) {
      console.log(`📥 Found ${completedData.length} recently completed SOS markers, deleting from local DB`);
      for (const completedSOS of completedData) {
        await deleteSOSMarker(completedSOS.id);
      }
    }

    // Clean up orphaned markers: markers in local DB that don't exist in cloud
    const localMarkers = await getActiveSOSMarkers();
    const cloudIds = new Set(activeData?.map(m => m.id) || []);
    
    for (const localMarker of localMarkers) {
      if (!cloudIds.has(localMarker.id)) {
        console.log(`🧹 Removing orphaned SOS marker from local DB: ${localMarker.id.substring(0, 12)}`);
        await deleteSOSMarker(localMarker.id);
      }
    }
  } catch (error) {
    console.error('❌ Error pulling SOS markers from cloud:', error);
  }
}

/**
 * Pull SOS responses from cloud
 */
async function pullSOSResponsesFromCloud(): Promise<void> {
  if (!supabase) return;

  try {
    const { data, error } = await supabase
      .from('sos_responses')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error pulling SOS responses:', error);
      return;
    }

    if (!data || data.length === 0) {
      return;
    }

    console.log(`📥 Pulled ${data.length} SOS responses from cloud`);

    for (const cloudResponse of data) {
      await upsertSOSResponse(cloudResponse);
    }
  } catch (error) {
    console.error('❌ Error pulling SOS responses from cloud:', error);
  }
}

/**
 * Subscribe to real-time SOS updates
 */
function subscribeToSOSRealtimeUpdates(): void {
  if (!supabase) return;

  console.log('🔔 Subscribing to SOS real-time updates...');

  // Subscribe to SOS markers
  supabase
    .channel('sos_markers_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sos_markers',
      },
      (payload) => {
        console.log('🔔 SOS marker update received:', payload.eventType);
        
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const cloudSOS = payload.new as SupabaseSOSMarker;
          
          // If the SOS is completed, DELETE it from local DB immediately
          if (cloudSOS.status === 'completed') {
            console.log('✅ Real-time: SOS completed, deleting from local DB:', cloudSOS.id.substring(0, 12));
            deleteSOSMarker(cloudSOS.id).catch(err => 
              console.error('Error deleting completed SOS:', err)
            );
            return;
          }
          
          upsertSOSMarker(cloudSOS).then(() => {
            console.log('✅ Real-time SOS marker synced:', cloudSOS.id.substring(0, 12), 'status:', cloudSOS.status);
          });
        } else if (payload.eventType === 'DELETE') {
          const deletedId = payload.old?.id;
          if (deletedId) {
            console.log('✅ Real-time: SOS deleted from cloud:', deletedId.substring(0, 12));
            deleteSOSMarker(deletedId).catch(err =>
              console.error('Error deleting SOS:', err)
            );
          }
        }
      }
    )
    .subscribe();

  // Subscribe to SOS responses
  supabase
    .channel('sos_responses_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'sos_responses',
      },
      (payload) => {
        console.log('🔔 SOS response update received:', payload.eventType);
        
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const cloudResponse = payload.new as SupabaseSOSResponse;
          upsertSOSResponse(cloudResponse).then(() => {
            console.log('✅ Real-time SOS response synced:', cloudResponse.id);
          });
        }
      }
    )
    .subscribe();
}
