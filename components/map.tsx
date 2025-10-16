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
import { useMapInstance } from '@/hooks/map/useMapInstance';
import { useMapMarkers } from '@/hooks/map/useMapMarkers';
import { useMapSOSMarkers } from '@/hooks/map/useMapSOSMarkers';
import { useMapTrail } from '@/hooks/map/useMapTrail';
import { useMapTrailProgressAndUserMarker } from '@/hooks/map/useMapTrailProgressAndUserMarker';
import { useMapUserLocation } from '@/hooks/map/useMapUserLocation';
import { useMapActions } from '@/hooks/map/shared/useMapActions';
import { useMapModals } from '@/hooks/useMapModals';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { uiLogger } from '@/utils/logger';
import { handleManualSync } from '@/utils/map-handlers';
import Constants from 'expo-constants';
import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

export default function MapComponent() {
  const { location, isTracking, trackingStatus, currentCountry, isLocating } = useLocation();
  const { markers, addMarker: dbAddMarker, isReady: dbReady, refreshMarkers, triggerSync, deviceId } = useDatabase();
  const { activeSOSMarkers } = useSOS();
  const { activeTrail } = useTrail();
  
  // Custom hooks for state management
  const isOnline = useNetworkStatus();
  const modals = useMapModals();
  
  const webViewRef = useRef<WebView>(null)
  const [refreshing, setRefreshing] = useState(false);

  // Get MapTiler API key from environment
  const mapTilerKey = Constants.expoConfig?.extra?.mapTilerKey || process.env.EXPO_PUBLIC_MAPTILER_KEY || '';

  const { mapReady, setMapReady, initialLocation } = useMapInstance({
    webViewRef,
    location
  })

  const { refreshMapMarkers } = useMapMarkers({
    webViewRef,
    mapReady,
    markers,
    refreshing
  })

  useMapSOSMarkers({
    webViewRef,
    mapReady,
    sosMarkers: activeSOSMarkers
  })

  useMapTrail({
    webViewRef,
    mapReady,
    activeTrail
  })

  useMapTrailProgressAndUserMarker({
    webViewRef,
    mapReady,
    activeTrail,
    location
  })

  useMapUserLocation({
    webViewRef,
    mapReady,
    location
  })

  const { onSaveMarker, onVote } = useMapActions({
    deviceId,
    dbReady,
    dbAddMarker,
    modals
  });

  // Memoize HTML content so it only creates ONCE (not on every location update)
  // Only recreate when we get initial location or API key changes
  const htmlContent = useMemo(() => {
    const lat = initialLocation.current?.coords.latitude || region.center.latitude;
    const lng = initialLocation.current?.coords.longitude || region.center.longitude;
    const zoom = initialLocation.current ? 15 : 6;

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body, html {
          margin: 0;
          padding: 0;
          height: 100%;
          width: 100%;
        }
        #map {
          height: 100%;
          width: 100%;
        }
        /* Position zoom controls lower */
        .leaflet-top.leaflet-right {
          top: 60px;
        }
        
        /* Position zoom controls above recenter button */
        .leaflet-top.leaflet-right {
          top: auto !important;
          bottom: 150px; /* Position above recenter button (which is at 100px) */
        }
        
        /* Style zoom control buttons to match recenter button */
        .leaflet-control-zoom a {
          width: 40px !important;
          height: 40px !important;
          line-height: 40px !important;
          font-size: 20px !important;
          border-radius: 4px !important;
        }
        
        .leaflet-control-zoom {
          border: none !important;
        }
        
        .leaflet-control-zoom a {
          border: 2px solid rgba(0,0,0,0.2) !important;
          margin-bottom: 4px;
        }
        
        .leaflet-control-zoom a:first-child {
          border-radius: 4px !important;
        }
        
        .leaflet-control-zoom a:last-child {
          border-radius: 4px !important;
        }
        
        /* Style for recenter button */
        .recenter-button {
          position: absolute;
          bottom: 100px;
          right: 10px;
          width: 40px;
          height: 40px;
          background: white;
          border: 2px solid rgba(0,0,0,0.2);
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          z-index: 1000;
        }
        .recenter-button:hover {
          background: #f4f4f4;
        }
        .recenter-button:active {
          background: #e8e8e8;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      
      <!-- Recenter button -->
      <button class="recenter-button" onclick="recenterMap()" title="Go to my location">
        📍
      </button>
      
      <script>
        // Use initial location (won't change on re-renders)
        var initialLat = ${lat};
        var initialLng = ${lng};
        var initialZoom = ${zoom};

        // Initialize map
        var map = L.map('map', {
          zoomControl: false,  // We'll add custom positioned controls
          attributionControl: true
        }).setView([initialLat, initialLng], initialZoom);

        // Add zoom controls on the right side, positioned lower
        L.control.zoom({
          position: 'topright'
        }).addTo(map);

        // Add MapTiler Streets tiles (highly detailed, great for Africa)
        // Fallback to OSM Carto if no API key provided
        var tileUrl = '${mapTilerKey}' 
          ? 'https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${mapTilerKey}'
          : 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png';
        
        L.tileLayer(tileUrl, {
          attribution: '${mapTilerKey}' 
            ? '© MapTiler © OpenStreetMap contributors' 
            : '© OpenStreetMap contributors',
          maxZoom: 22,
          minZoom: 1,
          subdomains: ['a', 'b', 'c']
        }).addTo(map);

        // Custom user marker icon
        var userIcon = L.divIcon({
          className: 'user-marker',
          html: '<div style="width: 20px; height: 20px; background: #007AFF; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        // User marker at current location
        var userMarker = L.marker([initialLat, initialLng], {
          icon: userIcon
        }).addTo(map);

        // Make map and marker accessible globally
        window.map = map;
        window.userMarker = userMarker;

        // Function to recenter map on user's current location
        window.recenterMap = function() {
          map.setView(userMarker.getLatLng(), 17, {
            animate: true,
            duration: 0.5
          });
        };

        // Trail rendering variables
        var trailPolyline = null;
        var userMarkerOnTrail = null;

        // Function to draw trail on map
        window.drawTrail = function(waypoints, color, shouldFitBounds, isOffline) {
          console.log('🗺️ Drawing trail with ' + waypoints.length + ' waypoints');
          
          // Remove existing trail
          if (trailPolyline) {
            map.removeLayer(trailPolyline);
          }
          
          // Convert waypoints to LatLng array
          var latLngs = waypoints.map(function(wp) {
            return [wp.lat, wp.lon];
          });
          
          // Draw trail polyline with different style for offline routes
          trailPolyline = L.polyline(latLngs, {
            color: color,
            weight: 4,
            opacity: isOffline ? 0.6 : 0.8,
            lineJoin: 'round',
            lineCap: 'round',
            dashArray: isOffline ? '10, 10' : null  // Dashed line for offline
          }).addTo(map);
          
          // Only zoom to show entire trail on initial creation
          if (shouldFitBounds === true) {
            map.fitBounds(trailPolyline.getBounds(), {
              padding: [50, 50],
              maxZoom: 16
            });
          }
          
          // Update user marker on trail
          if (waypoints.length > 0) {
            updateUserMarkerOnTrail(waypoints[0].lat, waypoints[0].lon);
          }
        };

        // Function to clear trail from map
        window.clearTrail = function() {
          console.log('🗺️ Clearing trail');
          
          if (trailPolyline) {
            map.removeLayer(trailPolyline);
            trailPolyline = null;
          }
          if (userMarkerOnTrail) {
            map.removeLayer(userMarkerOnTrail);
            userMarkerOnTrail = null;
          }
        };

        // Function to update user position marker on trail
        window.updateUserMarkerOnTrail = function(lat, lon) {
          if (userMarkerOnTrail) {
            userMarkerOnTrail.setLatLng([lat, lon]);
          } else {
            userMarkerOnTrail = L.circleMarker([lat, lon], {
              radius: 10,
              color: '#FFFFFF',
              fillColor: '#007AFF',
              fillOpacity: 1,
              weight: 3
            }).addTo(map);
          }
        };

        // Notify React Native that map is ready
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));

        // Handle long-press on map to add marker
        map.on('contextmenu', function(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'addMarker',
            lat: e.latlng.lat,
            lng: e.latlng.lng
          }));
        });

        // Initialize empty SafePath markers object
        window.safePathMarkers = {};
        window.sosMarkers = {};
      </script>
    </body>
    </html>
    `;
  }, [mapTilerKey]);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'mapReady') {
        setMapReady(true);
      } else if (data.type === 'addMarker') {
        // Long-press detected - show add marker modal
        modals.openAddMarker(data.lat, data.lng);
      } else if (data.type === 'markerClick') {
        // Regular marker clicked
        const marker = markers.find(m => m.id === data.markerId);
        if (marker) {
          modals.openMarkerDetails(marker);
        }
      } else if (data.type === 'sosMarkerClick') {
        // SOS marker clicked
        const sosMarker = activeSOSMarkers.find(m => m.id === data.sosMarkerId);
        if (sosMarker) {
          modals.openSOSDetails(sosMarker);
        }
      }
    } catch (e) {
      uiLogger.error('Error parsing message from WebView:', e);
    }
  };

  // Handle manual sync
  const onManualSync = async () => {
    setRefreshing(true);
    try {
      await handleManualSync({
        triggerSync,
        refreshMarkers,
        onSuccess: () => refreshMapMarkers(markers),
      });
    } catch (error) {
      uiLogger.error('❌ Manual sync failed:', error);
      alert('Sync failed. Check your internet connection.');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={styles.map}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
      />

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
});
