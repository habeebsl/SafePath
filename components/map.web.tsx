import { Alert } from '@/components/Alert';
import { MapModals } from '@/components/map/MapModals';
import { MapOverlays } from '@/components/map/MapOverlays';
import { SOSButton } from '@/components/sos/SOSButton';
import { SOSNotificationBanner } from '@/components/sos/SOSNotificationBanner';
import { TrailBottomBar } from '@/components/trail/TrailBottomBar';
import region from '@/config/region.json';
import { generateMarkerHTML } from '@/constants/marker-icons';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useLocation } from '@/contexts/LocationContext';
import { useSOS } from '@/contexts/SOSContext';
import { useTrail } from '@/contexts/TrailContext';
import { useMapModals } from '@/hooks/useMapModals';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { Marker, MarkerType } from '@/types/marker';
import { SOSMarker } from '@/types/sos';
import { uiLogger } from '@/utils/logger';
import { handleManualSync, handleSaveMarker } from '@/utils/map-handlers';
import { getRemainingWaypoints } from '@/utils/trail-helpers';
import Constants from 'expo-constants';
import React, { useEffect, useRef, useState } from 'react';
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
  
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [initialLocationSet, setInitialLocationSet] = useState(false);
  const markerIdsRef = useRef<string>(''); // Track marker IDs to detect changes
  
  // Track current trail ID to prevent re-rendering on progress updates
  const currentTrailIdRef = useRef<string | null>(null);
  
  // Store initial location when GPS first gets a fix
  const initialLocation = useRef<typeof location>(null);
  
  // Store references to Leaflet markers and trail elements
  const markerLayersRef = useRef<{ [key: string]: any }>({});
  const sosMarkerLayersRef = useRef<{ [key: string]: any }>({});
  const trailPolylineRef = useRef<any>(null);
  const userMarkerOnTrailRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);

  // Get MapTiler API key from environment
  const mapTilerKey = Constants.expoConfig?.extra?.mapTilerKey || process.env.EXPO_PUBLIC_MAPTILER_KEY || '';

  // Detect client-side rendering
  useEffect(() => {
    uiLogger.info('🌍 Checking if client-side...', typeof window !== 'undefined');
    setIsClient(typeof window !== 'undefined');
  }, []);

  // Capture the first location we get from GPS
  useEffect(() => {
    if (location && !initialLocation.current) {
      initialLocation.current = location;
      setInitialLocationSet(true);
    }
  }, [location]);

  // Center map on user location when we first get GPS fix
  useEffect(() => {
    if (initialLocationSet && mapReady && mapRef.current && location) {
      uiLogger.info('📍 Auto-centering map on first GPS fix');
      mapRef.current.setView(
        [location.coords.latitude, location.coords.longitude],
        17,
        { animate: true }
      );
    }
  }, [initialLocationSet, mapReady]);

  // Update user marker position when location changes (but don't recenter map)
  useEffect(() => {
    if (location && mapReady && userMarkerRef.current) {
      const newLatLng = [location.coords.latitude, location.coords.longitude];
      userMarkerRef.current.setLatLng(newLatLng);
      // Don't call setView here - let user pan around freely
      // Only recenter when they click the recenter button
    }
  }, [location, mapReady]);

  // Calculate initial map center and zoom
  const initialCenter: [number, number] = location 
    ? [location.coords.latitude, location.coords.longitude]
    : [region.center.latitude, region.center.longitude];
  const initialZoom = location ? 15 : 6;

  // Handle map click to add marker (right-click or long-press)
  const handleMapClick = (e: L.LeafletMouseEvent) => {
    modals.openAddMarker(e.latlng.lat, e.latlng.lng);
  };

  // Handle saving new marker
  const onSaveMarker = async (data: {
    type: MarkerType;
    title: string;
    description: string;
    latitude: number;
    longitude: number;
  }) => {
    try {
      await handleSaveMarker({
        data,
        deviceId,
        dbReady,
        dbAddMarker,
        onSuccess: () => {
          modals.closeAddMarker();
        },
      });
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save marker');
    }
  };

  // Handle voting on marker
  const onVote = (vote: 'agree' | 'disagree') => {
    // This is handled by the database context in MarkerDetailsModal
    // Just close the modal after voting
    modals.closeMarkerDetails();
  };

  // Add marker to Leaflet map with custom icon
  const addMarkerToMap = (marker: Marker) => {
    if (!mapReady || !mapRef.current || !L) return;

    // Remove existing marker with same ID to prevent duplicates
    if (markerLayersRef.current[marker.id]) {
      mapRef.current.removeLayer(markerLayersRef.current[marker.id]);
      delete markerLayersRef.current[marker.id];
    }

    const markerHTML = generateMarkerHTML(marker.type, marker.confidenceScore);
    
    const icon = L.divIcon({
      className: 'custom-marker',
      html: markerHTML,
      iconSize: [40, 50],
      iconAnchor: [20, 50],
      popupAnchor: [0, -50]
    });
    
    const leafletMarker = L.marker([marker.latitude, marker.longitude], {
      icon: icon
    }).addTo(mapRef.current);
    
    leafletMarker.on('click', () => {
      modals.openMarkerDetails(marker);
    });
    
    markerLayersRef.current[marker.id] = leafletMarker;
  };

  // Clear all markers from map
  const clearAllMarkers = () => {
    if (!mapRef.current) return;
    
    Object.values(markerLayersRef.current).forEach((marker: any) => {
      mapRef.current.removeLayer(marker);
    });
    
    markerLayersRef.current = {};
  };

  // Add SOS marker to Leaflet map
  const addSOSMarkerToMap = (sosMarker: SOSMarker) => {
    if (!mapReady || !mapRef.current || !L) return;

    // Remove existing SOS marker with same ID to prevent duplicates
    if (sosMarkerLayersRef.current[sosMarker.id]) {
      mapRef.current.removeLayer(sosMarkerLayersRef.current[sosMarker.id]);
      delete sosMarkerLayersRef.current[sosMarker.id];
    }

    const markerHTML = generateMarkerHTML('sos' as MarkerType, 100, sosMarker.status);
    
    const icon = L.divIcon({
      className: 'custom-marker sos-marker',
      html: markerHTML,
      iconSize: [48, 58],
      iconAnchor: [24, 58],
      popupAnchor: [0, -58]
    });
    
    const leafletMarker = L.marker([sosMarker.latitude, sosMarker.longitude], {
      icon: icon
    }).addTo(mapRef.current);
    
    leafletMarker.on('click', () => {
      modals.openSOSDetails(sosMarker);
    });
    
    sosMarkerLayersRef.current[sosMarker.id] = leafletMarker;
  };

  // Clear all SOS markers from map
  const clearSOSMarkers = () => {
    if (!mapRef.current) return;
    
    Object.values(sosMarkerLayersRef.current).forEach((marker: any) => {
      mapRef.current.removeLayer(marker);
    });
    
    sosMarkerLayersRef.current = {};
  };

  // Refresh all markers on map
  const refreshMapMarkers = () => {
    uiLogger.info('Refreshing markers on map: ' + markers.length);
    clearAllMarkers();
    setTimeout(() => {
      markers.forEach(marker => addMarkerToMap(marker));
      uiLogger.info('Added markers on map: ' + markers.length);
    }, 100); // Small delay to ensure clear completes
  };

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

  // Update markers on map when markers change
  useEffect(() => {
    if (!mapReady) return;
    
    // Create a stable identifier for the current set of markers
    const currentMarkerIds = markers.map(m => m.id).sort().join(',');
    
    // Only refresh if markers actually changed
    if (markerIdsRef.current !== currentMarkerIds) {
      uiLogger.info(`🗺️ [Web] Markers changed, updating map (${markers.length} markers)`);
      markerIdsRef.current = currentMarkerIds;
      refreshMapMarkers();
    }
  }, [markers, mapReady]);

  // Update SOS markers on map when they change
  useEffect(() => {
    if (!mapReady) return;
    
    clearSOSMarkers();
    activeSOSMarkers.forEach(sosMarker => addSOSMarkerToMap(sosMarker));
  }, [activeSOSMarkers.length, mapReady]);

  // Update SOS markers on map when they change
  useEffect(() => {
    if (mapReady) {
      uiLogger.info('🗺️ Updating SOS markers on map:', activeSOSMarkers.length);
      // Clear existing SOS markers
      clearSOSMarkers();
      // Re-add all SOS markers
      activeSOSMarkers.forEach(sosMarker => {
        uiLogger.info('➕ Adding SOS marker to map:', sosMarker.id);
        addSOSMarkerToMap(sosMarker);
      });
    }
  }, [activeSOSMarkers, mapReady]);

  // Render active trail on map (only when trail changes, not on progress updates)
  useEffect(() => {
    if (!mapReady || !mapRef.current || !L) return;

    const newTrailId = activeTrail ? `${activeTrail.targetMarker.id}-${activeTrail.context}` : null;
    
    // Only update if trail actually changed (not just progress update)
    if (currentTrailIdRef.current === newTrailId) return;
    
    currentTrailIdRef.current = newTrailId;

    if (activeTrail) {
      // Draw trail (auto-zoom on first creation)
      const waypoints = activeTrail.route.waypoints;
      const isOffline = activeTrail.route.strategy === 'offline';
      
      // Remove existing trail
      if (trailPolylineRef.current) {
        mapRef.current.removeLayer(trailPolylineRef.current);
      }
      
      // Draw trail polyline with different style for offline routes
      trailPolylineRef.current = L.polyline(
        waypoints.map((wp: any) => [wp.lat, wp.lon]),
        {
          color: activeTrail.color,
          weight: 4,
          opacity: isOffline ? 0.6 : 0.8,
          lineJoin: 'round',
          lineCap: 'round',
          dashArray: isOffline ? '10, 10' : null
        }
      ).addTo(mapRef.current);
      
      // Auto-zoom to show entire trail on initial creation
      mapRef.current.fitBounds(trailPolylineRef.current.getBounds(), {
        padding: [50, 50],
        maxZoom: 16
      });
      
      uiLogger.info('🗺️ Trail rendered on map');
    } else {
      // Clear trail
      if (trailPolylineRef.current) {
        mapRef.current.removeLayer(trailPolylineRef.current);
        trailPolylineRef.current = null;
      }
      if (userMarkerOnTrailRef.current) {
        mapRef.current.removeLayer(userMarkerOnTrailRef.current);
        userMarkerOnTrailRef.current = null;
      }
      uiLogger.info('🗺️ Trail cleared from map');
    }
  }, [activeTrail, mapReady]);

  // Update trail as user moves (show remaining path from current position)
  useEffect(() => {
    if (!location || !activeTrail || !mapReady || !mapRef.current || !L) return;
    
    const currentPos = { lat: location.coords.latitude, lon: location.coords.longitude };
    const remainingWaypoints = getRemainingWaypoints(activeTrail.route.waypoints, currentPos);
    const isOffline = activeTrail.route.strategy === 'offline';
    
    // Update trail to show only remaining path
    if (trailPolylineRef.current) {
      mapRef.current.removeLayer(trailPolylineRef.current);
    }
    
    trailPolylineRef.current = L.polyline(
      remainingWaypoints.map((wp: any) => [wp.lat, wp.lon]),
      {
        color: activeTrail.color,
        weight: 4,
        opacity: isOffline ? 0.6 : 0.8,
        lineJoin: 'round',
        lineCap: 'round',
        dashArray: isOffline ? '10, 10' : null
      }
    ).addTo(mapRef.current);
  }, [location, activeTrail, mapReady]);

  // Update user position on trail as they move
  useEffect(() => {
    if (location && activeTrail && mapReady && mapRef.current && L) {
      if (userMarkerOnTrailRef.current) {
        userMarkerOnTrailRef.current.setLatLng([location.coords.latitude, location.coords.longitude]);
      } else {
        userMarkerOnTrailRef.current = L.circleMarker([location.coords.latitude, location.coords.longitude], {
          radius: 10,
          color: '#FFFFFF',
          fillColor: '#007AFF',
          fillOpacity: 1,
          weight: 3
        }).addTo(mapRef.current);
      }
    }
  }, [location, activeTrail, mapReady]);

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
          ref={(map: any) => {
            if (map && !mapReady) {
              mapRef.current = map;
              setMapReady(true);
              uiLogger.info('🗺️ Map instance created');
            }
          }}
        >
        {/* Map Event Handler - for right-click/long-press to add marker */}
        <MapEventHandler onContextMenu={handleMapClick} />
        
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

        {/* SafePath Markers and SOS Markers are added programmatically via addMarkerToMap() and addSOSMarkerToMap() 
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
