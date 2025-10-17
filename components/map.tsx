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
import { useMapInstance } from '@/hooks/map/useMapInstance';
import { useMapMarkers } from '@/hooks/map/useMapMarkers';
import { useMapSOSMarkers } from '@/hooks/map/useMapSOSMarkers';
import { useMapTrail } from '@/hooks/map/useMapTrail';
import { useMapTrailProgressAndUserMarker } from '@/hooks/map/useMapTrailProgressAndUserMarker';
import { useMapUserLocation } from '@/hooks/map/useMapUserLocation';
import { useMapModals } from '@/hooks/useMapModals';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { uiLogger } from '@/utils/logger';
import { handleManualSync } from '@/utils/map-handlers';
import Mapbox from '@rnmapbox/maps';
import Constants from 'expo-constants';
import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

// Initialize Mapbox
const mapTilerKey = Constants.expoConfig?.extra?.mapTilerKey || process.env.EXPO_PUBLIC_MAPTILER_KEY || '';
Mapbox.setAccessToken(null); // We're using MapTiler, not Mapbox

export default function MapComponent() {
  const { location, isTracking, trackingStatus, currentCountry, isLocating } = useLocation();
  const { markers, addMarker: dbAddMarker, isReady: dbReady, refreshMarkers, triggerSync, deviceId } = useDatabase();
  const { activeSOSMarkers } = useSOS();
  const { activeTrail } = useTrail();
  
  // Custom hooks for state management
  const isOnline = useNetworkStatus();
  const modals = useMapModals();
  
  const mapRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { mapReady, setMapReady, initialLocation } = useMapInstance({
    mapRef,
    cameraRef,
    location
  });

  const { markersGeoJSON } = useMapMarkers({
    mapRef,
    mapReady,
    markers,
    refreshing
  });

  const { sosMarkersGeoJSON } = useMapSOSMarkers({
    mapRef,
    mapReady,
    sosMarkers: activeSOSMarkers
  });

  const { trailGeoJSON } = useMapTrail({
    mapRef,
    mapReady,
    activeTrail
  });

  const { remainingTrailGeoJSON } = useMapTrailProgressAndUserMarker({
    mapRef,
    mapReady,
    activeTrail,
    location
  });

  useMapUserLocation({
    mapRef,
    mapReady,
    location
  });

  const { onSaveMarker, onVote } = useMapActions({
    deviceId,
    dbReady,
    dbAddMarker,
    modals
  });

  const handleMapReady = () => {
    uiLogger.info('🗺️ Native MapLibre map initialized');
    setMapReady(true);
  };

  const handleLongPress = async (feature: any) => {
    if (!dbReady) {
      uiLogger.warn('⚠️ Database not ready for marker creation');
      return;
    }

    const { coordinates } = feature.geometry;
    const [longitude, latitude] = coordinates;
    
    uiLogger.info('📍 Long press detected at:', { latitude, longitude });
    modals.openAddMarker(latitude, longitude);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await handleManualSync({
        refreshMarkers,
        triggerSync,
        onSuccess: () => {
          uiLogger.info('🔄 Map refreshed successfully');
        }
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Get initial camera position
  const initialCenter = initialLocation.current
    ? [initialLocation.current.coords.longitude, initialLocation.current.coords.latitude]
    : [region.center.longitude, region.center.latitude];
  
  const initialZoom = initialLocation.current ? 15 : 6;

  // MapTiler style URL
  const styleURL = `https://api.maptiler.com/maps/streets-v2/style.json?key=${mapTilerKey}`;

  return (
    <View style={styles.container}>
      <Mapbox.MapView
        ref={mapRef}
        style={styles.map}
        styleURL={styleURL}
        onDidFinishLoadingMap={handleMapReady}
        onLongPress={handleLongPress}
        compassEnabled={true}
        scaleBarEnabled={false}
        logoEnabled={false}
        attributionEnabled={true}
        attributionPosition={{ bottom: 8, right: 8 }}
      >
        <Mapbox.Camera
          ref={cameraRef}
          zoomLevel={initialZoom}
          centerCoordinate={initialCenter as [number, number]}
          animationMode="flyTo"
          animationDuration={1000}
        />

        <Mapbox.UserLocation
          visible={true}
          showsUserHeadingIndicator={true}
        />

        {/* Regular Markers */}
        {markersGeoJSON && (
          <Mapbox.ShapeSource id="markers-source" shape={markersGeoJSON}>
            <Mapbox.SymbolLayer
              id="markers-layer"
              style={{
                iconImage: ['get', 'icon'],
                iconSize: 1,
                iconAllowOverlap: true,
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* SOS Markers */}
        {sosMarkersGeoJSON && (
          <Mapbox.ShapeSource id="sos-markers-source" shape={sosMarkersGeoJSON}>
            <Mapbox.CircleLayer
              id="sos-markers-layer"
              style={{
                circleRadius: 15,
                circleColor: '#FF3B30',
                circleStrokeWidth: 3,
                circleStrokeColor: '#FFFFFF',
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* Trail Line */}
        {trailGeoJSON && (
          <Mapbox.ShapeSource id="trail-source" shape={trailGeoJSON}>
            <Mapbox.LineLayer
              id="trail-layer"
              style={{
                lineColor: '#007AFF',
                lineWidth: 6,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {/* Trail Progress Marker */}
        {remainingTrailGeoJSON && (
          <Mapbox.ShapeSource id="progress-marker-source" shape={remainingTrailGeoJSON}>
            <Mapbox.CircleLayer
              id="progress-marker-layer"
              style={{
                circleRadius: 10,
                circleColor: '#007AFF',
                circleStrokeWidth: 3,
                circleStrokeColor: '#FFFFFF',
              }}
            />
          </Mapbox.ShapeSource>
        )}
      </Mapbox.MapView>

      {/* Overlays */}
      <MapOverlays
        isTracking={isTracking}
        trackingStatus={trackingStatus}
        dbReady={dbReady}
        location={location}
        isOnline={isOnline}
        refreshing={refreshing}
        onSync={handleRefresh}
        activeTrail={activeTrail}
        currentCountry={currentCountry}
        isLocating={isLocating}
      />

      {/* Trail Bottom Bar */}
      <TrailBottomBar />

      {/* SOS Notification Banner */}
      <SOSNotificationBanner />

      {/* SOS Button */}
      <SOSButton />

      {/* Modals */}
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
});
