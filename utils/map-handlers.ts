/**
 * Map handler functions for markers and sync operations
 */

import { Marker, MarkerType } from '@/types/marker';
import { logger } from '@/utils/logger';

interface HandleSaveMarkerParams {
  data: {
    type: MarkerType;
    title: string;
    description: string;
    latitude: number;
    longitude: number;
    radius?: number;
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

  logger.info('🗺️ Saving new marker...');
  logger.info('📊 Data received:', JSON.stringify(data));
  logger.info('📏 Radius from data:', data.radius);
  
  const newMarker: Marker = {
    id: `marker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: data.type,
    latitude: data.latitude,
    longitude: data.longitude,
    title: data.title,
    description: data.description,
    radius: data.radius,
    createdBy: deviceId || 'unknown_device',
    createdAt: Date.now(),
    lastVerified: Date.now(),
    agrees: 1,
    disagrees: 0,
    confidenceScore: 100,
    syncedToServer: false,
  };
  
  logger.info('💾 Marker object created:', JSON.stringify(newMarker));
  logger.info('📏 Marker radius:', newMarker.radius);

  // Add to database (will automatically sync to cloud when online)
  await dbAddMarker(newMarker);
  
  // Call success callback if provided
  if (onSuccess) {
    onSuccess(newMarker);
  }

  logger.info('✅ Marker saved:', newMarker.id);
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
  logger.info('🔄 Starting manual sync...');
  
  // Trigger sync with cloud
  await triggerSync();
  
  // Refresh markers from database
  await refreshMarkers();
  
  // Call success callback if provided
  if (onSuccess) {
    onSuccess();
  }
  
  logger.info('✅ Manual sync completed');
}
