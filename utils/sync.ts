import { Marker, MarkerType } from '@/types/marker';
import { syncLogger } from '@/utils/logger';
import NetInfo from '@react-native-community/netinfo';
import {
  deleteMarker,
  deleteSOSMarker,
  getActiveSOSMarkers,
  getAllMarkers,
  getSyncedMarkers,
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

// Callback to notify when sync completes (for UI refresh)
let onSyncCompleteCallback: (() => void) | null = null;

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
        syncLogger.info(`🔍 Found similar marker within ${distance.toFixed(0)}m:`, cloudMarker.id);
        return cloudMarker;
      }
    }

    return null;
  } catch (error) {
    syncLogger.error('Error checking for similar markers:', error);
    return null;
  }
}

/**
 * Register a callback to be called when sync completes
 * Used by DatabaseContext to refresh UI after background sync
 */
export function setOnSyncComplete(callback: (() => void) | null): void {
  onSyncCompleteCallback = callback;
}

/**
 * Start the sync service
 * Monitors connectivity and syncs when online
 */
export function startSyncService(): void {
  if (!isSupabaseConfigured) {
    syncLogger.info('📡 Sync service disabled - Supabase not configured');
    return;
  }

  syncLogger.info('📡 Starting sync service...');

  // Monitor network connectivity
  NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable) {
      syncLogger.info('🌐 Network connected - triggering sync');
      performSync();
    } else {
      syncLogger.info('📴 Network disconnected - sync paused');
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
  syncLogger.info('🛑 Sync service stopped');
}

/**
 * Perform a full sync cycle
 */
async function performSync(): Promise<void> {
  if (!supabase || isCurrentlySyncing) return;

  isCurrentlySyncing = true;
  syncLogger.info('🔄 Starting sync...');

  try {
    // 1. Push unsynced local markers to cloud
    await pushLocalMarkersToCloud();

    // 2. Pull new markers from cloud to local
    await pullCloudMarkersToLocal();

    // 3. Reconcile synced markers (cleanup orphaned markers)
    await reconcileSyncedMarkers();

    // 4. Push unsynced SOS markers to cloud
    await pushSOSMarkersToCloud();

    // 5. Push unsynced SOS responses to cloud
    await pushSOSResponsesToCloud();

    // 6. Pull SOS markers from cloud
    await pullSOSMarkersFromCloud();

    // 7. Pull SOS responses from cloud
    await pullSOSResponsesFromCloud();

    syncLogger.info('✅ Sync completed successfully');
    
    // Notify listeners that sync is complete (for UI refresh)
    if (onSyncCompleteCallback) {
      syncLogger.debug('🔔 Notifying sync complete callback...');
      onSyncCompleteCallback();
    }
  } catch (error) {
    syncLogger.error('❌ Sync error:', error);
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
    syncLogger.info('📤 No markers to push');
    return;
  }

  syncLogger.info(`📤 Pushing ${unsyncedMarkers.length} markers to cloud...`);

  for (const marker of unsyncedMarkers) {
    try {
      // Check if a similar marker already exists in the cloud
      const existingMarker = await findSimilarMarkerInCloud(marker);

      if (existingMarker) {
        // Similar marker found - merge instead of creating duplicate
        syncLogger.info(`🔀 Merging marker ${marker.id} into existing ${existingMarker.id}`);
        syncLogger.info(`   Local: agrees=${marker.agrees}, disagrees=${marker.disagrees}`);
        syncLogger.info(`   Cloud: agrees=${existingMarker.agrees}, disagrees=${existingMarker.disagrees}`);
        
        // Take the HIGHER vote counts (don't add them together - that causes double counting!)
        // This assumes both platforms are syncing the cumulative vote totals
        const mergedAgrees = Math.max(existingMarker.agrees, marker.agrees);
        const mergedDisagrees = Math.max(existingMarker.disagrees, marker.disagrees);
        const totalVotes = mergedAgrees + mergedDisagrees;
        const mergedConfidenceScore = totalVotes > 0 ? Math.round((mergedAgrees / totalVotes) * 100) : 100;

        syncLogger.info(`   Merged: agrees=${mergedAgrees}, disagrees=${mergedDisagrees}`);

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
          syncLogger.error('❌ Error merging marker:', updateError);
        } else {
          // Mark local marker as synced (merged)
          await markMarkerAsSynced(marker.id);
          syncLogger.info(`✅ Merged marker ${marker.id} → ${existingMarker.id}`);
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
          radius: marker.radius || null,
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
          syncLogger.error('❌ Error pushing marker:', marker.id, error);
        } else {
          await markMarkerAsSynced(marker.id);
          syncLogger.info('✅ Pushed new marker:', marker.id);
        }
      }
    } catch (error) {
      syncLogger.error('❌ Error pushing marker:', marker.id, error);
    }
  }
}

/**
 * Pull new markers from Supabase to local database
 */
async function pullCloudMarkersToLocal(): Promise<void> {
  if (!supabase) return;

  try {
    // Get the timestamp of our most recent marker update
    const localMarkers = await getAllMarkers();
    const mostRecentVerified = localMarkers.length > 0
      ? Math.max(...localMarkers.map(m => m.lastVerified))
      : 0;

    syncLogger.info(`📥 Pulling markers updated since ${new Date(mostRecentVerified).toISOString()}...`);

    // Fetch markers from cloud that have been updated since our most recent
    const { data, error } = await supabase
      .from('markers')
      .select('*')
      .gt('last_verified', mostRecentVerified)
      .order('last_verified', { ascending: false });

    if (error) {
      syncLogger.error('❌ Error pulling markers:', error);
      return;
    }

    if (!data || data.length === 0) {
      syncLogger.info('📥 No updated markers to pull');
      return;
    }

    syncLogger.info(`📥 Pulled ${data.length} updated markers from cloud`);

    // Insert markers into local database
    for (const cloudMarker of data) {
      const marker: Marker = {
        id: cloudMarker.id,
        type: cloudMarker.type as MarkerType,
        latitude: cloudMarker.latitude,
        longitude: cloudMarker.longitude,
        title: cloudMarker.title,
        description: cloudMarker.description || '',
        radius: cloudMarker.radius || undefined,
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

    syncLogger.info('✅ Cloud markers synced to local database');
  } catch (error) {
    syncLogger.error('❌ Error pulling markers from cloud:', error);
  }
}

/**
 * Reconcile synced markers - check if locally synced markers still exist in cloud
 * Removes markers from local DB that have been deleted from cloud
 */
async function reconcileSyncedMarkers(): Promise<void> {
  if (!supabase) return;

  try {
    // Get all locally synced markers
    const syncedMarkers = await getSyncedMarkers();

    if (syncedMarkers.length === 0) {
      syncLogger.info('🔄 No synced markers to reconcile');
      return;
    }

    syncLogger.info(`🔄 Reconciling ${syncedMarkers.length} synced markers with cloud...`);

    // Get IDs of all local synced markers
    const localMarkerIds = syncedMarkers.map(m => m.id);

    // Fetch these markers from cloud to verify they still exist
    const { data: cloudMarkers, error } = await supabase
      .from('markers')
      .select('id')
      .in('id', localMarkerIds);

    if (error) {
      syncLogger.error('❌ Error fetching markers from cloud for reconciliation:', error);
      return;
    }

    // Get IDs of markers that exist in cloud
    const cloudMarkerIds = new Set(cloudMarkers?.map(m => m.id) || []);

    // Find markers that exist locally but not in cloud (orphaned)
    const orphanedMarkers = syncedMarkers.filter(m => !cloudMarkerIds.has(m.id));

    if (orphanedMarkers.length === 0) {
      syncLogger.info('✅ All synced markers exist in cloud - no cleanup needed');
      return;
    }

    syncLogger.info(`🗑️ Found ${orphanedMarkers.length} orphaned markers - cleaning up...`);

    // Delete orphaned markers from local DB
    for (const marker of orphanedMarkers) {
      try {
        await deleteMarker(marker.id);
        syncLogger.info(`✅ Deleted orphaned marker: ${marker.id}`);
      } catch (error) {
        syncLogger.error(`❌ Error deleting orphaned marker ${marker.id}:`, error);
      }
    }

    syncLogger.info(`✅ Reconciliation complete - removed ${orphanedMarkers.length} orphaned markers`);
  } catch (error) {
    syncLogger.error('❌ Error during marker reconciliation:', error);
  }
}

/**
 * Subscribe to real-time updates from Supabase
 */
function subscribeToRealtimeUpdates(): void {
  if (!supabase) return;

  syncLogger.info('🔔 Subscribing to real-time updates...');

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
        syncLogger.info('🔔 Real-time update received:', payload.eventType);
        
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const cloudMarker = payload.new as SupabaseMarker;
          
          const marker: Marker = {
            id: cloudMarker.id,
            type: cloudMarker.type as MarkerType,
            latitude: cloudMarker.latitude,
            longitude: cloudMarker.longitude,
            title: cloudMarker.title,
            description: cloudMarker.description || '',
            radius: cloudMarker.radius || undefined,
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
            syncLogger.info('✅ Real-time marker synced to local DB:', marker.id);
            // Notify UI to refresh after real-time update
            if (onSyncCompleteCallback) {
              onSyncCompleteCallback();
            }
          });
        } else if (payload.eventType === 'DELETE') {
          const deletedId = payload.old?.id;
          if (deletedId) {
            syncLogger.info('🗑️ Real-time: Marker deleted from cloud:', deletedId);
            deleteMarker(deletedId)
              .then(() => {
                syncLogger.info('✅ Marker deleted from local DB:', deletedId);
                // Notify UI to refresh after deletion
                if (onSyncCompleteCallback) {
                  syncLogger.debug('🔔 Notifying UI of marker deletion...');
                  onSyncCompleteCallback();
                }
              })
              .catch(err => syncLogger.error('Error deleting marker from local DB:', err));
          }
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
    syncLogger.info('📤 No SOS markers to push');
    return;
  }

  syncLogger.info(`📤 Pushing ${unsyncedSOS.length} SOS markers to cloud...`, 
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
        syncLogger.error('❌ Error pushing SOS marker:', sos.id, error);
      } else {
        await markSOSMarkerAsSynced(sos.id);
        syncLogger.info('✅ Pushed SOS marker:', sos.id);
      }
    } catch (error) {
      syncLogger.error('❌ Error pushing SOS marker:', sos.id, error);
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

  syncLogger.info(`📤 Pushing ${unsyncedResponses.length} SOS responses to cloud...`);

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
        // Check if it's a foreign key constraint error (SOS marker doesn't exist)
        if (error.code === '23503') {
          syncLogger.warn(
            '⚠️ SOS marker no longer exists for response:',
            response.id,
            '- canceling local response'
          );
          // Cancel the local response since the SOS marker is gone
          const { cancelSOSResponse } = await import('@/utils/database');
          await cancelSOSResponse(response.sos_marker_id, response.responder_device_id);
          syncLogger.info('✅ Canceled orphaned response:', response.id);
        } else {
          syncLogger.error('❌ Error pushing SOS response:', response.id, error);
        }
      } else {
        await markSOSResponseAsSynced(response.id);
        syncLogger.info('✅ Pushed SOS response:', response.id);
      }
    } catch (error) {
      syncLogger.error('❌ Error pushing SOS response:', response.id, error);
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
      syncLogger.error('❌ Error pulling active SOS markers:', activeError);
      return;
    }

    if (activeData && activeData.length > 0) {
      syncLogger.info(`📥 Pulled ${activeData.length} active SOS markers from cloud`);
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
      syncLogger.info(`📥 Found ${completedData.length} recently completed SOS markers, deleting from local DB`);
      for (const completedSOS of completedData) {
        await deleteSOSMarker(completedSOS.id);
      }
    }

    // Clean up orphaned markers: markers in local DB that don't exist in cloud
    const localMarkers = await getActiveSOSMarkers();
    const cloudIds = new Set(activeData?.map(m => m.id) || []);
    
    for (const localMarker of localMarkers) {
      if (!cloudIds.has(localMarker.id)) {
        syncLogger.info(`🧹 Removing orphaned SOS marker from local DB: ${localMarker.id.substring(0, 12)}`);
        await deleteSOSMarker(localMarker.id);
      }
    }
  } catch (error) {
    syncLogger.error('❌ Error pulling SOS markers from cloud:', error);
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
      syncLogger.error('❌ Error pulling SOS responses:', error);
      return;
    }

    if (!data || data.length === 0) {
      return;
    }

    syncLogger.info(`📥 Pulled ${data.length} SOS responses from cloud`);

    for (const cloudResponse of data) {
      await upsertSOSResponse(cloudResponse);
    }
  } catch (error) {
    syncLogger.error('❌ Error pulling SOS responses from cloud:', error);
  }
}

/**
 * Subscribe to real-time SOS updates
 */
function subscribeToSOSRealtimeUpdates(): void {
  if (!supabase) return;

  syncLogger.info('🔔 Subscribing to SOS real-time updates...');

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
        syncLogger.info('🔔 SOS marker update received:', payload.eventType);
        
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const cloudSOS = payload.new as SupabaseSOSMarker;
          
          // If the SOS is completed, DELETE it from local DB immediately
          if (cloudSOS.status === 'completed') {
            syncLogger.info('✅ Real-time: SOS completed, deleting from local DB:', cloudSOS.id.substring(0, 12));
            deleteSOSMarker(cloudSOS.id).catch(err => 
              syncLogger.error('Error deleting completed SOS:', err)
            );
            return;
          }
          
          upsertSOSMarker(cloudSOS).then(() => {
            syncLogger.info('✅ Real-time SOS marker synced:', cloudSOS.id.substring(0, 12), 'status:', cloudSOS.status);
          });
        } else if (payload.eventType === 'DELETE') {
          const deletedId = payload.old?.id;
          if (deletedId) {
            syncLogger.info('✅ Real-time: SOS deleted from cloud:', deletedId.substring(0, 12));
            deleteSOSMarker(deletedId).catch(err =>
              syncLogger.error('Error deleting SOS:', err)
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
        syncLogger.info('🔔 SOS response update received:', payload.eventType);
        
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const cloudResponse = payload.new as SupabaseSOSResponse;
          upsertSOSResponse(cloudResponse).then(() => {
            syncLogger.info('✅ Real-time SOS response synced:', cloudResponse.id);
          });
        }
      }
    )
    .subscribe();
}
