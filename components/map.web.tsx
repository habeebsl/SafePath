import { Alert } from '@/components/Alert';
import { MapModals } from '@/components/map/MapModals';
import { MapOverlays } from '@/components/map/MapOverlays';
import { SOSButton } from '@/components/sos/SOSButton';
import { SOSNotificationBanner } from '@/components/sos/SOSNotificationBanner';
import { TrailBottomBar } from '@/components/trail/TrailBottomBar';
import region from '@/config/region.json';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useLocation } from '@/contexts/LocationContext';
import { useSOS } from '@/contexts/SOSContext';
import { useTrail } from '@/contexts/TrailContext';
import { useMapActions } from '@/hooks/map/shared/useMapActions';
import { useMapInteractions } from '@/hooks/map/shared/useMapInteractions';
import { useMapInstance } from '@/hooks/map/web/useMapInstance.web';
import { useMapMarkers } from '@/hooks/map/web/useMapMarkers.web';
import { useMapSOSMarkers } from '@/hooks/map/web/useMapSOSMarkers.web';
import { useMapTrail } from '@/hooks/map/web/useMapTrail.web';
import { useMapTrailProgressAndUserMarker } from '@/hooks/map/web/useMapTrailProgressAndUserMarker.web';
import { useMapUserLocation } from '@/hooks/map/web/useMapUserLocation.web';
import { useMapModals } from '@/hooks/useMapModals';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { uiLogger } from '@/utils/logger';
import { handleManualSync } from '@/utils/map-handlers';
import Constants from 'expo-constants';
import React, { useEffect, useRef, useState } from 'react';
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
  });

  // Markers hook
  const { refreshMapMarkers } = useMapMarkers({
    map,
    mapReady,
    markers,
    modals,
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

  // Only log these on mount or when critical values change
  useEffect(() => {
    if (isClient) {
      uiLogger.info('✅ Client ready, rendering map with MapLibre');
      uiLogger.info('📍 Initial center:', initialCenter.current, 'Zoom:', initialZoom.current);
      uiLogger.info('🗺️ Database ready:', dbReady, 'Markers:', markers.length);
    }
  }, [isClient, dbReady, markers.length]);

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
          <Text style={styles.recenterButtonText}>📍</Text>
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

      {/* SOS Button */}
      <SOSButton />

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
    bottom: 100,
    right: 10,
    width: 40,
    height: 40,
    backgroundColor: '#fff',
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    boxShadow: '0px 2px 4px 0px rgba(0, 0, 0, 0.25)',
    elevation: 5,
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
      bottom: 150px !important; /* Position above recenter button (100px) + spacing */
    }
    
    /* Make zoom buttons larger and match design */
    .maplibregl-ctrl-group button {
      width: 40px !important;
      height: 40px !important;
      border-radius: 4px !important;
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
      border-radius: 4px !important;
      box-shadow: 0px 2px 4px 0px rgba(0, 0, 0, 0.25) !important;
    }
  `;
  document.head.appendChild(style);
}
