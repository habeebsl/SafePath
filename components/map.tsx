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
      <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
      <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
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
        
        /* Position MapLibre attribution at bottom left */
        .maplibregl-ctrl-attrib {
          background-color: rgba(255, 255, 255, 0.9) !important;
          font-size: 10px !important;
          padding: 2px 5px !important;
          margin-bottom: 0px !important;
          margin-left: 0px !important;
        }
        
        /* Move attribution above location info */
        .maplibregl-ctrl-bottom-left {
          bottom: 60px !important;  /* Position above location status bar */
        }
        
        /* Position zoom controls above recenter button */
        .maplibregl-ctrl-top-right {
          top: auto !important;
          bottom: 180px !important;
          right: 10px !important;
        }
        
        /* Style zoom control buttons */
        .maplibregl-ctrl-group button {
          width: 40px !important;
          height: 40px !important;
          border-radius: 4px !important;
        }
        
        /* Style for recenter button */
        .recenter-button {
          position: absolute;
          bottom: 120px;
          right: 20px;
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
          box-shadow: 0 0 0 2px rgba(0,0,0,.1);
        }
        .recenter-button:hover {
          background: #f4f4f4;
        }
        .recenter-button:active {
          background: #e8e8e8;
        }
        
        /* SOS marker pulse animation */
        @keyframes pulse {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.8;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
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

        // Initialize MapLibre map with vector tiles
        var map = new maplibregl.Map({
          container: 'map',
          style: 'https://api.maptiler.com/maps/streets-v2/style.json?key=${mapTilerKey}',
          center: [initialLng, initialLat],
          zoom: initialZoom,
          attributionControl: true,
          dragRotate: false,  // Disable rotation by dragging
          touchPitch: false,  // Disable pitch on touch devices
          pitchWithRotate: false  // Disable pitch
          // Don't set touchZoomRotate to false - we want pinch zoom to work
        });

        // Disable all rotation handlers after map loads, but keep zoom
        map.on('load', function() {
          map.dragRotate.disable();
          map.touchZoomRotate.disableRotation();  // Disable rotation only, keep zoom
          map.keyboard.disableRotation();
        });

        // Add navigation controls (zoom buttons only, no compass)
        map.addControl(new maplibregl.NavigationControl({
          showCompass: false,  // Hide compass button
          showZoom: true,
          visualizePitch: false
        }), 'top-right');

        // User marker on map
        var userMarkerElement = document.createElement('div');
        userMarkerElement.style.width = '20px';
        userMarkerElement.style.height = '20px';
        userMarkerElement.style.background = '#007AFF';
        userMarkerElement.style.border = '3px solid white';
        userMarkerElement.style.borderRadius = '50%';
        userMarkerElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';

        var userMarker = new maplibregl.Marker({
          element: userMarkerElement
        })
        .setLngLat([initialLng, initialLat])
        .addTo(map);

        // Make map and marker accessible globally
        window.map = map;
        window.userMarker = userMarker;

        // Function to recenter map on user's current location
        window.recenterMap = function() {
          var center = userMarker.getLngLat();
          map.flyTo({
            center: center,
            zoom: 17,
            duration: 500
          });
        };

        // Trail rendering variables
        var trailSourceId = 'trail-route';
        var trailLayerId = 'trail-layer';

        // Function to draw trail on map
        window.drawTrail = function(waypoints, color, shouldFitBounds, isOffline) {
          console.log('🗺️ Drawing trail with ' + waypoints.length + ' waypoints');
          
          // Convert waypoints to GeoJSON
          var coordinates = waypoints.map(function(wp) {
            return [wp.lon, wp.lat];
          });

          var geojson = {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: coordinates
            }
          };

          // Remove existing trail layer and source
          if (map.getLayer(trailLayerId)) {
            map.removeLayer(trailLayerId);
          }
          if (map.getSource(trailSourceId)) {
            map.removeSource(trailSourceId);
          }

          // Add new trail source and layer
          map.addSource(trailSourceId, {
            type: 'geojson',
            data: geojson
          });

          map.addLayer({
            id: trailLayerId,
            type: 'line',
            source: trailSourceId,
            paint: {
              'line-color': color || '#007AFF',
              'line-width': 4,  // Reduced from 6 to 4
              'line-opacity': 0.8
            }
          });

          // Fit bounds if requested with better padding
          if (shouldFitBounds && coordinates.length > 0) {
            var bounds = coordinates.reduce(function(bounds, coord) {
              return bounds.extend(coord);
            }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));

            map.fitBounds(bounds, {
              padding: {top: 100, bottom: 150, left: 50, right: 50},  // More padding at top/bottom
              duration: 1000,
              maxZoom: 15  // Don't zoom in too much
            });
          }
        };

        // Function to clear trail
        window.clearTrail = function() {
          if (map.getLayer(trailLayerId)) {
            map.removeLayer(trailLayerId);
          }
          if (map.getSource(trailSourceId)) {
            map.removeSource(trailSourceId);
          }
        };
          
        // Function to update user marker position on trail (for progress tracking)
        var userMarkerOnTrail = null;
        window.updateUserMarkerOnTrail = function(lat, lon) {
          if (userMarkerOnTrail) {
            userMarkerOnTrail.setLngLat([lon, lat]);
          } else {
            var progressElement = document.createElement('div');
            progressElement.style.width = '16px';
            progressElement.style.height = '16px';
            progressElement.style.background = '#007AFF';
            progressElement.style.border = '3px solid white';
            progressElement.style.borderRadius = '50%';
            progressElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';

            userMarkerOnTrail = new maplibregl.Marker({
              element: progressElement
            })
            .setLngLat([lon, lat])
            .addTo(map);
          }
        };

        // Notify React Native that map is ready
        map.on('load', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
        });

        // Handle long-press on map to add marker
        map.on('contextmenu', function(e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'addMarker',
            lat: e.lngLat.lat,
            lng: e.lngLat.lng
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
