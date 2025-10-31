import { MapModals } from '@/components/map/MapModals';
import { MapOverlays } from '@/components/map/MapOverlays';
import { SOSButton } from '@/components/sos/SOSButton';
import { SOSNotificationBanner } from '@/components/sos/SOSNotificationBanner';
import { SOSTorchButton } from '@/components/sos/SOSTorchButton';
import { TrailBottomBar } from '@/components/trail/TrailBottomBar';
import region from '@/config/region.json';
import { MARKER_CONFIG } from '@/constants/marker-icons';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useLocation } from '@/contexts/LocationContext';
import { useSOS } from '@/contexts/SOSContext';
import { useTrail } from '@/contexts/TrailContext';
import { useMapActions } from '@/hooks/map/shared/useMapActions';
import { useMapInstance } from '@/hooks/map/useMapInstance';
import { useMapMarkerRadii } from '@/hooks/map/useMapMarkerRadii';
import { useMapMarkers } from '@/hooks/map/useMapMarkers';
import { useMapSOSMarkers } from '@/hooks/map/useMapSOSMarkers';
import { useMapTrail } from '@/hooks/map/useMapTrail';
import { useMapTrailProgressAndUserMarker } from '@/hooks/map/useMapTrailProgressAndUserMarker';
import { useMapUserLocation } from '@/hooks/map/useMapUserLocation';
import { useMapModals } from '@/hooks/useMapModals';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { MarkerType } from '@/types/marker';
import { uiLogger } from '@/utils/logger';
import { handleManualSync } from '@/utils/map-handlers';
import Constants from 'expo-constants';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

export default function MapComponent() {
  const { location, isTracking, trackingStatus, currentCountry, isLocating } = useLocation();
  const { markers, addMarker: dbAddMarker, isReady: dbReady, refreshMarkers, triggerSync, deviceId } = useDatabase();
  const { activeSOSMarkers, completedSOSId, clearCompletedSOSId } = useSOS();
  const { activeTrail, cancelTrail } = useTrail();
  
  // Custom hooks for state management
  const isOnline = useNetworkStatus();
  const modals = useMapModals();
  
  const webViewRef = useRef<WebView>(null)
  const [refreshing, setRefreshing] = useState(false);
  const [previewRadius, setPreviewRadius] = useState<{ radius: number; markerType: MarkerType } | null>(null);

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

  // Display radius circles for markers that have a radius
  useMapMarkerRadii({
    webViewRef,
    mapReady,
    markers
  })

  useMapSOSMarkers({
    webViewRef,
    mapReady,
    sosMarkers: activeSOSMarkers
  })

  useMapTrail({
    webViewRef,
    mapReady,
    activeTrail,
    location
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
    location,
    activeTrail
  })

  const { onSaveMarker, onVote } = useMapActions({
    deviceId,
    dbReady,
    dbAddMarker,
    modals
  });

  // Auto-cancel trail when SOS is completed
  React.useEffect(() => {
    if (completedSOSId && activeTrail) {
      uiLogger.info('🛑 SOS completed, auto-canceling trail');
      cancelTrail();
      clearCompletedSOSId();
    }
  }, [completedSOSId, activeTrail, cancelTrail, clearCompletedSOSId]);

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
          right: 10px;
          width: 60px;
          height: 60px;
          background: white;
          color: black;
          border: 1px solid rgba(0,0,0,0.2);
          border-radius: 30px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          z-index: 1000;
          box-shadow: 0px 2px 4px 0px rgba(0, 0, 0, 0.25);
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
        
        /* Trail navigation pulse animation */
        @keyframes trailPulse {
          0% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.5);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 0.8;
          }
        }
        
        .navigation-pulse {
          position: absolute;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          animation: trailPulse 2s ease-out infinite;
          pointer-events: none;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      
      <!-- Recenter button -->
      <button class="recenter-button" onclick="recenterMap()" title="Go to my location">
        <svg xmlns="http://www.w3.org/2000/svg" height="26px" viewBox="0 -960 960 960" width="26px">
          <path d="M440-42v-80q-125-14-214.5-103.5T122-440H42v-80h80q14-125 103.5-214.5T440-838v-80h80v80q125 14 214.5 103.5T838-520h80v80h-80q-14 125-103.5 214.5T520-122v80h-80Zm40-158q116 0 198-82t82-198q0-116-82-198t-198-82q-116 0-198 82t-82 198q0 116 82 198t198 82Zm0-120q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47Zm0-80q33 0 56.5-23.5T560-480q0-33-23.5-56.5T480-560q-33 0-56.5 23.5T400-480q0 33 23.5 56.5T480-400Zm0-80Z"/>
        </svg>
      </button>
      
      <script>
        // Use initial location (won't change on re-renders)
        var initialLat = ${lat};
        var initialLng = ${lng};
        var initialZoom = ${zoom};

        // Initialize MapLibre map with vector tiles
        var map = new maplibregl.Map({
          container: 'map',
          style: 'https://api.maptiler.com/maps/streets-v2/style.json?key=' + '${mapTilerKey}',
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
          showZoom: false,
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
        userMarkerElement.style.display = 'flex';
        userMarkerElement.style.alignItems = 'center';
        userMarkerElement.style.justifyContent = 'center';

        var userMarker = new maplibregl.Marker({
          element: userMarkerElement,
          anchor: 'center',  // Center the marker on the coordinates
          rotationAlignment: 'map'
        })
        .setLngLat([initialLng, initialLat])
        .addTo(map);

        // Trail navigation state
        var isNavigating = false;
        var trailColor = '#007AFF';
        var pulseElement = null;
        
        // Function to enable trail navigation mode
        window.enableNavigationMode = function(color) {
          isNavigating = true;
          trailColor = color || '#007AFF';
          
          // Update marker size and style
          userMarkerElement.style.width = '40px';
          userMarkerElement.style.height = '40px';
          userMarkerElement.style.background = trailColor;
          userMarkerElement.style.border = '4px solid white';
          
          // Add navigation arrow
          userMarkerElement.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#ffffff" style="display: block;"><path d="m200-120-40-40 320-720 320 720-40 40-280-120-280 120Z"/></svg>';
          
          // Remove existing pulse if any
          if (pulseElement && pulseElement.parentNode) {
            pulseElement.parentNode.removeChild(pulseElement);
            pulseElement = null;
          }
          
          // Create new pulse effect
          pulseElement = document.createElement('div');
          pulseElement.className = 'navigation-pulse';
          pulseElement.style.backgroundColor = trailColor;
          pulseElement.style.top = '-5px';
          pulseElement.style.left = '-5px';
          userMarkerElement.appendChild(pulseElement);
        };
        
        // Function to disable trail navigation mode
        window.disableNavigationMode = function() {
          isNavigating = false;
          
          // Reset marker size and style
          userMarkerElement.style.width = '20px';
          userMarkerElement.style.height = '20px';
          userMarkerElement.style.background = '#007AFF';
          userMarkerElement.style.border = '3px solid white';
          userMarkerElement.innerHTML = '';
          
          // Remove pulse
          if (pulseElement && pulseElement.parentNode) {
            pulseElement.parentNode.removeChild(pulseElement);
            pulseElement = null;
          }
          
          // Reset rotation
          userMarker.setRotation(0);
        };
        
        // Function to update marker rotation based on bearing to next waypoint
        window.updateNavigationBearing = function(lat, lon, nextWaypointLat, nextWaypointLon) {
          if (!isNavigating) return;
          
          // Calculate bearing between two points
          var lat1 = lat * Math.PI / 180;
          var lat2 = nextWaypointLat * Math.PI / 180;
          var dLon = (nextWaypointLon - lon) * Math.PI / 180;
          
          var y = Math.sin(dLon) * Math.cos(lat2);
          var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
          var bearing = Math.atan2(y, x) * 180 / Math.PI;
          
          // Set marker rotation
          userMarker.setRotation(bearing);
        };

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

        // Long-press detection for adding markers
        var longPressTimer = null;
        var longPressStartPos = null;
        var LONG_PRESS_DELAY = 500; // 500ms for long press
        var MOVE_THRESHOLD = 10; // pixels - if finger moves more than this, cancel long press

        map.on('touchstart', function(e) {
          if (e.originalEvent.touches.length !== 1) return; // Only single touch
          
          longPressStartPos = {
            x: e.originalEvent.touches[0].clientX,
            y: e.originalEvent.touches[0].clientY,
            lngLat: e.lngLat
          };
          
          longPressTimer = setTimeout(function() {
            if (longPressStartPos) {
              // Trigger long press
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'addMarker',
                lat: longPressStartPos.lngLat.lat,
                lng: longPressStartPos.lngLat.lng
              }));
              longPressStartPos = null;
            }
          }, LONG_PRESS_DELAY);
        });

        map.on('touchmove', function(e) {
          if (!longPressStartPos || !e.originalEvent.touches.length) return;
          
          var currentX = e.originalEvent.touches[0].clientX;
          var currentY = e.originalEvent.touches[0].clientY;
          var deltaX = currentX - longPressStartPos.x;
          var deltaY = currentY - longPressStartPos.y;
          var distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          
          if (distance > MOVE_THRESHOLD) {
            // Finger moved too much, cancel long press
            clearTimeout(longPressTimer);
            longPressStartPos = null;
          }
        });

        map.on('touchend', function(e) {
          clearTimeout(longPressTimer);
          longPressStartPos = null;
        });

        map.on('touchcancel', function(e) {
          clearTimeout(longPressTimer);
          longPressStartPos = null;
        });

        // Keep contextmenu for desktop right-click
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

  // Handle radius preview
  const handleRadiusPreview = useCallback((radius: number | null, markerType: MarkerType) => {
    if (radius && radius > 0 && modals.selectedLocation && modals.showAddMarker) {
      const { lat, lng } = modals.selectedLocation;
      const markerColor = MARKER_CONFIG[markerType].color;
      
      setPreviewRadius({ radius, markerType });
      
      webViewRef.current?.injectJavaScript(`
        (function() {
          const map = window.map;
          if (!map) return;
          
          const sourceId = 'radius-preview-source';
          const layerId = 'radius-preview-layer';
          const outlineLayerId = layerId + '-outline';
          
          const radiusInMeters = ${radius};
          const lat = ${lat};
          const lng = ${lng};
          const markerColor = '${markerColor}';
          
          const metersToLngDegrees = (meters, latitude) => {
            return meters / (111320 * Math.cos(latitude * Math.PI / 180));
          };
          const metersToLatDegrees = (meters) => {
            return meters / 110574;
          };
          
          const points = 64;
          const coordinates = [];
          for (let i = 0; i <= points; i++) {
            const angle = (i / points) * 2 * Math.PI;
            const dx = radiusInMeters * Math.cos(angle);
            const dy = radiusInMeters * Math.sin(angle);
            
            const lon = lng + metersToLngDegrees(dx, lat);
            const latCoord = lat + metersToLatDegrees(dy);
            coordinates.push([lon, latCoord]);
          }
          
          const circleData = {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [coordinates]
            },
            properties: {}
          };
          
          // Check if source exists - if yes, just update data
          const existingSource = map.getSource(sourceId);
          if (existingSource && existingSource.type === 'geojson') {
            existingSource.setData(circleData);
            
            // Update colors
            map.setPaintProperty(layerId, 'fill-color', markerColor);
            map.setPaintProperty(outlineLayerId, 'line-color', markerColor);
            
            // Fit map to show the circle with padding
            const radiusInDegLng = metersToLngDegrees(radiusInMeters, lat);
            const radiusInDegLat = metersToLatDegrees(radiusInMeters);
            
            map.fitBounds([
              [lng - radiusInDegLng, lat - radiusInDegLat],
              [lng + radiusInDegLng, lat + radiusInDegLat]
            ], {
              padding: { top: 100, bottom: 500, left: 50, right: 50 },
              duration: 500,
              maxZoom: 16
            });
          } else {
            // Remove old layers if they exist
            if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId);
            if (map.getLayer(layerId)) map.removeLayer(layerId);
            if (map.getSource(sourceId)) map.removeSource(sourceId);
            
            // Create new source and layers
            map.addSource(sourceId, {
              type: 'geojson',
              data: circleData
            });
            
            map.addLayer({
              id: layerId,
              type: 'fill',
              source: sourceId,
              paint: {
                'fill-color': markerColor,
                'fill-opacity': 0.15
              }
            });
            
            map.addLayer({
              id: outlineLayerId,
              type: 'line',
              source: sourceId,
              paint: {
                'line-color': markerColor,
                'line-width': 2,
                'line-opacity': 0.6
              }
            });
            
            // Fit map to show the circle with padding
            const radiusInDegLng = metersToLngDegrees(radiusInMeters, lat);
            const radiusInDegLat = metersToLatDegrees(radiusInMeters);
            
            map.fitBounds([
              [lng - radiusInDegLng, lat - radiusInDegLat],
              [lng + radiusInDegLng, lat + radiusInDegLat]
            ], {
              padding: { top: 100, bottom: 500, left: 50, right: 50 },
              duration: 500,
              maxZoom: 16
            });
          }
        })();
        true;
      `);
    } else {
      setPreviewRadius(null);
      
      // Remove preview circle
      webViewRef.current?.injectJavaScript(`
        (function() {
          const map = window.map;
          if (!map) return;
          
          const sourceId = 'radius-preview-source';
          const layerId = 'radius-preview-layer';
          const outlineLayerId = layerId + '-outline';
          
          if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId);
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        })();
        true;
      `);
    }
  }, [modals.selectedLocation, modals.showAddMarker]);

  // Forcefully clear preview when modal closes
  useEffect(() => {
    if (!modals.showAddMarker && webViewRef.current) {
      uiLogger.info('🧹 Modal closed - forcefully clearing preview radius');
      setPreviewRadius(null);
      
      webViewRef.current.injectJavaScript(`
        (function() {
          const map = window.map;
          if (!map) return;
          
          const sourceId = 'radius-preview-source';
          const layerId = 'radius-preview-layer';
          const outlineLayerId = layerId + '-outline';
          
          if (map.getLayer(outlineLayerId)) {
            map.removeLayer(outlineLayerId);
            console.log('✅ Removed preview outline layer');
          }
          if (map.getLayer(layerId)) {
            map.removeLayer(layerId);
            console.log('✅ Removed preview fill layer');
          }
          if (map.getSource(sourceId)) {
            map.removeSource(sourceId);
            console.log('✅ Removed preview source');
          }
        })();
        true;
      `);
    }
  }, [modals.showAddMarker]);

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
        mixedContentMode="always"
        cacheEnabled={false}
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

      {/* SOS Button */}
      <SOSButton />

      {/* SOS Torch Button */}
      <SOSTorchButton />

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
