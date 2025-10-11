/**
 * Map handler functions for markers and sync operations
 */

import { Marker, MarkerType } from '@/types/marker';

interface HandleSaveMarkerParams {
  data: {
    type: MarkerType;
    title: string;
    description: string;
    latitude: number;
    longitude: number;
  };
  deviceId: string | null;
  dbReady: boolean;
  dbAddMarker: (marker: Marker) => Promise<void>;
  onSuccess?: (marker: Marker) => void;
}

/**
 * Handle saving a new marker
 */
export async function handleSaveMarker({
  data,
  deviceId,
  dbReady,
  dbAddMarker,
  onSuccess,
}: HandleSaveMarkerParams): Promise<void> {
  // Check if database is ready
  if (!dbReady) {
    throw new Error('Database is still initializing. Please wait a moment and try again.');
  }

  console.log('🗺️ Saving new marker...');
  const newMarker: Marker = {
    id: `marker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: data.type,
    latitude: data.latitude,
    longitude: data.longitude,
    title: data.title,
    description: data.description,
    createdBy: deviceId || 'unknown_device',
    createdAt: Date.now(),
    lastVerified: Date.now(),
    agrees: 1,
    disagrees: 0,
    confidenceScore: 100,
    syncedToServer: false,
  };

  // Add to database (will automatically sync to cloud when online)
  await dbAddMarker(newMarker);
  
  // Call success callback if provided
  if (onSuccess) {
    onSuccess(newMarker);
  }

  console.log('✅ Marker saved:', newMarker.id);
}

interface HandleManualSyncParams {
  triggerSync: () => Promise<void>;
  refreshMarkers: () => Promise<void>;
  onSuccess?: () => void;
}

/**
 * Handle manual sync operation
 */
export async function handleManualSync({
  triggerSync,
  refreshMarkers,
  onSuccess,
}: HandleManualSyncParams): Promise<void> {
  console.log('🔄 Starting manual sync...');
  
  // Trigger sync with cloud
  await triggerSync();
  
  // Refresh markers from database
  await refreshMarkers();
  
  // Call success callback if provided
  if (onSuccess) {
    onSuccess();
  }
  
  console.log('✅ Manual sync completed');
}
