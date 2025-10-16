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
import { useMapInstance } from '@/hooks/map/web/useMapInstance.web';
import { useMapUserLocation } from '@/hooks/map/web/useMapUserLocation.web';
import { useMapMarkers } from '@/hooks/map/web/useMapMarkers.web';
import { useMapSOSMarkers } from '@/hooks/map/web/useMapSOSMarkers.web';
import { useMapTrail } from '@/hooks/map/web/useMapTrail.web';
import { useMapTrailProgressAndUserMarker } from '@/hooks/map/web/useMapTrailProgressAndUserMarker.web';
import { useMapInteractions } from '@/hooks/map/shared/useMapInteractions';
import { useMapActions } from '@/hooks/map/shared/useMapActions';
import { useMapModals } from '@/hooks/useMapModals';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { uiLogger } from '@/utils/logger';
import { handleManualSync } from '@/utils/map-handlers';
import { getRemainingWaypoints } from '@/utils/trail-helpers';
import Constants from 'expo-constants';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Dynamically import Leaflet to avoid SSR issues
let L: any;
let MapContainer: any;
let TileLayer: any;
let LeafletMarker: any;
let Polyline: any;
let ZoomControl: any;
let useMapEvents: any;

if (typeof window !== 'undefined') {
  L = require('leaflet');
  require('leaflet/dist/leaflet.css');
  const ReactLeaflet = require('react-leaflet');
  MapContainer = ReactLeaflet.MapContainer;
  TileLayer = ReactLeaflet.TileLayer;
  LeafletMarker = ReactLeaflet.Marker;
  Polyline = ReactLeaflet.Polyline;
  ZoomControl = ReactLeaflet.ZoomControl;
  useMapEvents = ReactLeaflet.useMapEvents;
}

// Component to handle map events (must be inside MapContainer)
function MapEventHandler({ onContextMenu }: { onContextMenu: (e: any) => void }) {
  if (!useMapEvents) return null;
  
  useMapEvents({
    contextmenu: (e: any) => {
      onContextMenu(e);
    },
  });
  
  return null;
}

export default function MapComponent() {
  uiLogger.info('🗺️ MapComponent rendering (web version)...');
  
  const { location, isTracking, trackingStatus, currentCountry, isLocating } = useLocation();
  const { markers, addMarker: dbAddMarker, isReady: dbReady, refreshMarkers, triggerSync, deviceId } = useDatabase();
  const { activeSOSMarkers } = useSOS();
  const { activeTrail } = useTrail();
  
  // Custom hooks for state management
  const isOnline = useNetworkStatus();
  const modals = useMapModals();
  
  const [refreshing, setRefreshing] = useState(false);
  
  // Store references to Leaflet trail
  const userMarkerOnTrailRef = useRef<any>(null);

  // Get MapTiler API key from environment
  const mapTilerKey = Constants.expoConfig?.extra?.mapTilerKey || process.env.EXPO_PUBLIC_MAPTILER_KEY || '';

  // Calculate initial map center and zoom
  const initialCenter: [number, number] = location 
    ? [location.coords.latitude, location.coords.longitude]
    : [region.center.latitude, region.center.longitude];
  const initialZoom = location ? 15 : 6;

  // Map instance hook
  const { mapRef, mapReady, isClient, handleMapRef } = useMapInstance({
    location,
    initialCenter,
    initialZoom,
  });

  // User location marker hook
  useMapUserLocation({
    location,
    mapReady,
  });

  // Markers hook
  const { refreshMapMarkers } = useMapMarkers({
    markers,
    mapReady,
    mapRef,
    modals,
  });

  // SOS Markers hook
  useMapSOSMarkers({
    activeSOSMarkers,
    mapReady,
    mapRef,
    modals
  })

  // Map trail hooks
  const { trailPolylineRef } = useMapTrail({
    activeTrail,
    mapReady,
    mapRef
  })

  useMapTrailProgressAndUserMarker({
    location,
    activeTrail,
    mapReady,
    mapRef,
    trailPolylineRef,
    userMarkerOnTrailRef
  })

  const { handleMapClick } = useMapInteractions({ modals })

  const { onSaveMarker, onVote } = useMapActions({
    deviceId,
    dbReady,
    dbAddMarker,
    modals
  })

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

  // Calculate trail waypoints for rendering
  const trailWaypoints = activeTrail ? getRemainingWaypoints(
    activeTrail.route.waypoints,
    location ? { lat: location.coords.latitude, lon: location.coords.longitude } : activeTrail.route.waypoints[0]
  ) : null;

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

  uiLogger.info('✅ Client ready, rendering map with Leaflet:', !!MapContainer);
  uiLogger.info('📍 Initial center:', initialCenter, 'Zoom:', initialZoom);
  uiLogger.info('🗺️ Database ready:', dbReady, 'Markers:', markers.length);

  return (
    <View style={styles.container}>
      {MapContainer ? (
        <>
        <MapContainer
          center={initialCenter}
          zoom={initialZoom}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          ref={handleMapRef}
        >
        {/* Map Event Handler - for right-click/long-press to add marker */}
        <MapEventHandler onContextMenu={e => handleMapClick(e.latlng.lat, e.latlng.lng)} />
        
        {/* Zoom Control - positioned bottom right */}
        {ZoomControl && <ZoomControl position="bottomright" />}
        
        {/* Tile Layer */}
        <TileLayer
          url={mapTilerKey 
            ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${mapTilerKey}`
            : 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png'
          }
          attribution={mapTilerKey 
            ? '© MapTiler © OpenStreetMap contributors' 
            : '© OpenStreetMap contributors'
          }
          maxZoom={22}
          minZoom={1}
        />

        {/* User Location Marker */}
        {location && L && (
          <LeafletMarker
            position={[location.coords.latitude, location.coords.longitude]}
            icon={L.divIcon({
              className: 'user-location-marker',
              html: '<div style="width: 20px; height: 20px; background: #007AFF; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
              iconSize: [26, 26],
              iconAnchor: [13, 13],
            })}
          />
        )}

        {/* SafePath Markers and SOS Markers are added pr() and addSOSMarkerToMap() 
            with custom HTML icons. They are NOT rendered here to avoid duplicate markers. */}

        {/* Active Trail */}
        {trailWaypoints && trailWaypoints.length > 1 && (
          <Polyline
            positions={trailWaypoints.map(wp => [wp.lat, wp.lon])}
            pathOptions={{
              color: activeTrail?.color || '#007AFF',
              weight: 4,
              opacity: 0.8,
            }}
          />
        )}
      </MapContainer>
      
      {/* Recenter Button */}
      {mapReady && location && (
        <TouchableOpacity
          style={styles.recenterButton}
          onPress={() => {
            if (mapRef.current && location) {
              mapRef.current.setView(
                [location.coords.latitude, location.coords.longitude],
                17,
                { animate: true }
              );
            }
          }}
        >
          <Text style={styles.recenterButtonText}>📍</Text>
        </TouchableOpacity>
      )}
      </>
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Map library not loaded</Text>
        </View>
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

// Add CSS to position zoom controls above recenter button
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    /* Position only zoom control, not all bottom-right controls */
    .leaflet-bottom.leaflet-right .leaflet-control-zoom {
      margin-bottom: 130px !important;
    }
    .leaflet-control-zoom a {
      width: 40px !important;
      height: 40px !important;
      line-height: 40px !important;
      font-size: 20px !important;
      border-radius: 4px !important;
      border: 2px solid rgba(0,0,0,0.2) !important;
      margin-bottom: 4px;
    }
    .leaflet-control-zoom {
      border: none !important;
    }
  `;
  document.head.appendChild(style);
}
