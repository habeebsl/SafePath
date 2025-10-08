import { Marker, MarkerType } from '@/types/marker';
import NetInfo from '@react-native-community/netinfo';
import {
    getAllMarkers,
    getUnsyncedMarkers,
    markMarkerAsSynced,
    upsertMarker,
} from './database';
import { isSupabaseConfigured, supabase, SupabaseMarker } from './supabase';

let syncInterval: ReturnType<typeof setInterval> | null = null;
let isCurrentlySyncing = false;

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
}

/**
 * Stop the sync service
 */
export function stopSyncService(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  console.log('📡 Sync service stopped');
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

    console.log('✅ Sync completed successfully');
  } catch (error) {
    console.error('❌ Sync error:', error);
  } finally {
    isCurrentlySyncing = false;
  }
}

/**
 * Push unsynced local markers to Supabase
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
        console.log('✅ Pushed marker:', marker.id);
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
