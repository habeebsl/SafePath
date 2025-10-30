import { Alert } from '@/components/Alert';
import { MapModals } from '@/components/map/MapModals';
import { MapOverlays } from '@/components/map/MapOverlays';
import { SOSNotificationBanner } from '@/components/sos/SOSNotificationBanner';
import { TrailBottomBar } from '@/components/trail/TrailBottomBar';
import region from '@/config/region.json';
import { MARKER_CONFIG } from '@/constants/marker-icons';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useLocation } from '@/contexts/LocationContext';
import { useSOS } from '@/contexts/SOSContext';
import { useTrail } from '@/contexts/TrailContext';
import { useMapActions } from '@/hooks/map/shared/useMapActions';
import { useMapInteractions } from '@/hooks/map/shared/useMapInteractions';
import { useMapInstance } from '@/hooks/map/web/useMapInstance.web';
import { useMapMarkerRadii } from '@/hooks/map/web/useMapMarkerRadii.web';
import { useMapMarkers } from '@/hooks/map/web/useMapMarkers.web';
import { useMapSOSMarkers } from '@/hooks/map/web/useMapSOSMarkers.web';
import { useMapTrail } from '@/hooks/map/web/useMapTrail.web';
import { useMapTrailProgressAndUserMarker } from '@/hooks/map/web/useMapTrailProgressAndUserMarker.web';
import { useMapUserLocation } from '@/hooks/map/web/useMapUserLocation.web';
import { useMapModals } from '@/hooks/useMapModals';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { MarkerType } from '@/types/marker';
import { uiLogger } from '@/utils/logger';
import { handleManualSync } from '@/utils/map-handlers';
import Constants from 'expo-constants';
import maplibregl from 'maplibre-gl';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Import MapLibre CSS
if (typeof window !== 'undefined') {
  require('maplibre-gl/dist/maplibre-gl.css');
}

export default function MapComponent() {
  uiLogger.info('🗺️ MapComponent rendering (web version - MapLibre)...');
  
  const { location, isTracking, trackingStatus, currentCountry, isLocating } = useLocation();
  const { markers, addMarker: dbAddMarker, isReady: dbReady, refreshMarkers, triggerSync, deviceId } = useDatabase();
  const { activeSOSMarkers } = useSOS();
  const { activeTrail } = useTrail();
  
  // Custom hooks for state management
  const isOnline = useNetworkStatus();
  const modals = useMapModals();
  
  const [refreshing, setRefreshing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [previewRadius, setPreviewRadius] = useState<{ radius: number; markerType: MarkerType } | null>(null);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Get MapTiler API key from environment
  const mapTilerKey = Constants.expoConfig?.extra?.mapTilerKey || process.env.EXPO_PUBLIC_MAPTILER_KEY || '';

  // Calculate initial map center and zoom ONCE (use refs to prevent re-initialization)
  const initialCenter = useRef<[number, number]>(
    location 
      ? [location.coords.latitude, location.coords.longitude]
      : [region.center.latitude, region.center.longitude]
  );
  const initialZoom = useRef(location ? 15 : 6);

  // Detect client-side rendering
  useEffect(() => {
    setIsClient(typeof window !== 'undefined');
  }, []);

  // Map instance hook
  const { map, mapReady } = useMapInstance({
    mapContainer: mapContainerRef,
    location,
    initialCenter: initialCenter.current,
    initialZoom: initialZoom.current,
    mapTilerKey,
    isClient,
  });

  // User location marker hook
  useMapUserLocation({
    map,
    mapReady,
    location,
    activeTrail,
  });

  // Markers hook
  const { refreshMapMarkers } = useMapMarkers({
    map,
    mapReady,
    markers,
    modals,
  });

  // Marker radius circles hook
  useMapMarkerRadii({
    map,
    mapReady,
    markers,
  });

  // SOS Markers hook
  useMapSOSMarkers({
    map,
    mapReady,
    sosMarkers: activeSOSMarkers,
    modals,
  });

  // Debug: Log map ready state
  useEffect(() => {
    uiLogger.info('🗺️ Map ready state changed:', mapReady, 'Map instance:', !!map);
  }, [mapReady, map]);

  // Map trail hooks
  useMapTrail({
    map,
    mapReady,
    activeTrail,
  });

  useMapTrailProgressAndUserMarker({
    map,
    mapReady,
    location,
    activeTrail,
  });

  // Debug: Log activeTrail changes
  useEffect(() => {
    if (activeTrail) {
      uiLogger.info('🗺️ Active trail detected in component:', {
        id: activeTrail.targetMarker.id,
        waypointsCount: activeTrail.route.waypoints.length,
        color: activeTrail.color,
        strategy: activeTrail.route.strategy,
      });
    } else {
      uiLogger.info('🗺️ No active trail');
    }
  }, [activeTrail]);

  const { handleMapClick } = useMapInteractions({ modals });

  const { onSaveMarker, onVote } = useMapActions({
    deviceId,
    dbReady,
    dbAddMarker,
    modals,
  });

  // Handle manual sync
  const onManualSync = async () => {
    setRefreshing(true);
    try {
      await handleManualSync({
        triggerSync,
        refreshMarkers,
        onSuccess: refreshMapMarkers,
      });
    } catch (error) {
      uiLogger.error('❌ Manual sync failed:', error);
      Alert.alert('Sync Failed', 'Check your internet connection and try again.');
    } finally {
      setRefreshing(false);
    }
  };

  // Handle radius preview
  const handleRadiusPreview = useCallback((radius: number | null, markerType: MarkerType) => {
    if (radius && radius > 0) {
      setPreviewRadius({ radius, markerType });
    } else {
      setPreviewRadius(null);
    }
  }, []);

  // Only log these on mount or when critical values change
  useEffect(() => {
    if (isClient) {
      uiLogger.info('✅ Client ready, rendering map with MapLibre');
      uiLogger.info('📍 Initial center:', initialCenter.current, 'Zoom:', initialZoom.current);
      uiLogger.info('🗺️ Database ready:', dbReady, 'Markers:', markers.length);
    }
  }, [isClient, dbReady, markers.length]);

  // Listen for map context menu (right-click) events
  useEffect(() => {
    if (!isClient) return;

    const handleContextMenu = (event: Event) => {
      const customEvent = event as CustomEvent<{ lat: number; lng: number }>;
      const { lat, lng } = customEvent.detail;
      handleMapClick(lat, lng);
    };

    window.addEventListener('mapContextMenu', handleContextMenu);
    uiLogger.info('👆 Map context menu listener registered');

    return () => {
      window.removeEventListener('mapContextMenu', handleContextMenu);
    };
  }, [isClient, handleMapClick]);

  // Render radius preview circle
  useEffect(() => {
    if (!map || !mapReady) return;

    const sourceId = 'radius-preview-source';
    const layerId = 'radius-preview-layer';
    const outlineLayerId = `${layerId}-outline`;

    // If no radius or modal closed, remove layers and return
    if (!previewRadius || previewRadius.radius <= 0 || !modals.selectedLocation || !modals.showAddMarker) {
      if (map.getLayer(outlineLayerId)) {
        map.removeLayer(outlineLayerId);
      }
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
      return;
    }

    const { lat, lng } = modals.selectedLocation;
    const radiusInMeters = previewRadius.radius;
    const markerColor = MARKER_CONFIG[previewRadius.markerType].color;

    // Calculate circle coordinates
    const metersToLngDegrees = (meters: number, latitude: number) => {
      return meters / (111320 * Math.cos(latitude * Math.PI / 180));
    };
    const metersToLatDegrees = (meters: number) => {
      return meters / 110574;
    };

    const points = 64;
    const coordinates: [number, number][] = [];
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * 2 * Math.PI;
      const dx = radiusInMeters * Math.cos(angle);
      const dy = radiusInMeters * Math.sin(angle);
      
      const lon = lng + metersToLngDegrees(dx, lat);
      const latCoord = lat + metersToLatDegrees(dy);
      coordinates.push([lon, latCoord]);
    }

    const circleData = {
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [coordinates],
      },
      properties: {},
    };

    // Check if source exists - if yes, just update data
    const existingSource = map.getSource(sourceId);
    if (existingSource && existingSource.type === 'geojson') {
      (existingSource as maplibregl.GeoJSONSource).setData(circleData);
      
      // Update paint properties for color change
      map.setPaintProperty(layerId, 'fill-color', markerColor);
      map.setPaintProperty(outlineLayerId, 'line-color', markerColor);
      
      // Fit map to show the circle with padding
      const radiusInDegLng = metersToLngDegrees(radiusInMeters, lat);
      const radiusInDegLat = metersToLatDegrees(radiusInMeters);
      
      map.fitBounds([
        [lng - radiusInDegLng, lat - radiusInDegLat],
        [lng + radiusInDegLng, lat + radiusInDegLat]
      ], {
        padding: { top: 100, bottom: 400, left: 100, right: 100 }, // Extra padding for modal
        duration: 500,
        maxZoom: 16
      });
    } else {
      // Create source and layers for first time
      if (!existingSource) {
        map.addSource(sourceId, {
          type: 'geojson',
          data: circleData,
        });
      }

      if (!map.getLayer(layerId)) {
        map.addLayer({
          id: layerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': markerColor,
            'fill-opacity': 0.15,
          },
        });
      }

      if (!map.getLayer(outlineLayerId)) {
        map.addLayer({
          id: outlineLayerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': markerColor,
            'line-width': 2,
            'line-opacity': 0.6,
          },
        });
      }
      
      // Fit map to show the circle with padding
      const radiusInDegLng = metersToLngDegrees(radiusInMeters, lat);
      const radiusInDegLat = metersToLatDegrees(radiusInMeters);
      
      map.fitBounds([
        [lng - radiusInDegLng, lat - radiusInDegLat],
        [lng + radiusInDegLng, lat + radiusInDegLat]
      ], {
        padding: { top: 100, bottom: 400, left: 100, right: 100 },
        duration: 500,
        maxZoom: 16
      });
    }

    return () => {
      // Cleanup on unmount only
      if (map.getLayer(outlineLayerId)) {
        map.removeLayer(outlineLayerId);
      }
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    };
  }, [map, mapReady, previewRadius, modals.selectedLocation, modals.showAddMarker]);

  // Force clear preview when modal closes
  useEffect(() => {
    if (!modals.showAddMarker && map && mapReady) {
      const sourceId = 'radius-preview-source';
      const layerId = 'radius-preview-layer';
      const outlineLayerId = `${layerId}-outline`;

      // Force remove preview layers
      if (map.getLayer(outlineLayerId)) {
        map.removeLayer(outlineLayerId);
      }
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
      
      // Also clear the preview state
      setPreviewRadius(null);
    }
  }, [modals.showAddMarker, map, mapReady]);

  // Show loading state during SSR or before client hydration
  if (!isClient) {
    uiLogger.info('⏳ Still loading client side...');
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading map...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* MapLibre Container */}
      <div 
        ref={mapContainerRef} 
        style={{ width: '100%', height: '100%' }} 
      />
      
      {/* Recenter Button */}
      {mapReady && location && map && (
        <TouchableOpacity
          style={styles.recenterButton}
          onPress={() => {
            map.flyTo({
              center: [location.coords.longitude, location.coords.latitude],
              zoom: 17,
              duration: 1000,
            });
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" height="26px" viewBox="0 -960 960 960" width="26px">
            <path d="M440-42v-80q-125-14-214.5-103.5T122-440H42v-80h80q14-125 103.5-214.5T440-838v-80h80v80q125 14 214.5 103.5T838-520h80v80h-80q-14 125-103.5 214.5T520-122v80h-80Zm40-158q116 0 198-82t82-198q0-116-82-198t-198-82q-116 0-198 82t-82 198q0 116 82 198t198 82Zm0-120q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T560-480q0-33-23.5-56.5T480-560q-33 0-56.5 23.5T400-480q0 33 23.5 56.5T480-400Zm0-80Z"/>
          </svg>
        </TouchableOpacity>
      )}

      {/* Map Overlays (badges, status indicators, sync button) */}
      <MapOverlays
        isTracking={isTracking}
        trackingStatus={trackingStatus}
        dbReady={dbReady}
        location={location}
        isOnline={isOnline}
        refreshing={refreshing}
        onSync={onManualSync}
        activeTrail={activeTrail}
        currentCountry={currentCountry}
        isLocating={isLocating}
      />

      {/* All Modals (markers and SOS) */}
      <MapModals
        showAddMarker={modals.showAddMarker}
        selectedLocation={modals.selectedLocation}
        onCloseAddMarker={modals.closeAddMarker}
        onSaveMarker={onSaveMarker}
        onRadiusPreview={handleRadiusPreview}
        showMarkerDetails={modals.showMarkerDetails}
        selectedMarker={modals.selectedMarker}
        onCloseMarkerDetails={modals.closeMarkerDetails}
        onVote={onVote}
        showSOSDetails={modals.showSOSDetails}
        selectedSOSMarker={modals.selectedSOSMarker}
        onCloseSOSDetails={modals.closeSOSDetails}
      />

      {/* SOS Notification Banner */}
      <SOSNotificationBanner />

      {/* Trail Bottom Bar */}
      <TrailBottomBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  recenterButton: {
    position: 'absolute',
    bottom: 212,
    right: 20,
    width: 40,
    height: 40,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    // boxShadow: '0px 2px 4px 0px rgba(0, 0, 0, 0.25)',
    // elevation: 5,
  },
  recenterButtonText: {
    fontSize: 20,
  },
} as const);

// Add CSS to style MapLibre zoom controls - position above recenter button
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    /* Position MapLibre navigation controls above recenter button */
    .maplibregl-ctrl-bottom-right {
      right: 10px !important;
      bottom: 70px !important; /* Position above recenter button (100px) + spacing */
    }
    
    /* Make zoom buttons larger and match design */
    .maplibregl-ctrl-group button {
      width: 40px !important;
      height: 40px !important;
      border-radius: 10px !important;
      border: 2px solid rgba(0,0,0,0.2) !important;
      background-color: #fff !important;
      margin: 0 0 4px 0 !important;
    }
    
    .maplibregl-ctrl-group button:last-child {
      margin-bottom: 0 !important;
    }
    
    /* Larger icons */
    .maplibregl-ctrl-zoom-in .maplibregl-ctrl-icon,
    .maplibregl-ctrl-zoom-out .maplibregl-ctrl-icon {
      background-size: 20px 20px !important;
    }
    
    .maplibregl-ctrl-group {
      background: transparent !important;
      box-shadow: none !important;
    }
  `;
  document.head.appendChild(style);
}
