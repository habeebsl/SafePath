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
import { handleManualSync, handleSaveMarker } from '@/utils/map-handlers';
import { getRemainingWaypoints } from '@/utils/trail-helpers';
import Constants from 'expo-constants';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

export default function MapComponent() {
  const { location, isTracking, currentCountry, isLocating } = useLocation();
  const { markers, addMarker: dbAddMarker, isReady: dbReady, refreshMarkers, triggerSync, deviceId } = useDatabase();
  const { activeSOSMarkers } = useSOS();
  const { activeTrail } = useTrail();
  
  // Custom hooks for state management
  const isOnline = useNetworkStatus();
  const modals = useMapModals();
  
  const webViewRef = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [initialLocationSet, setInitialLocationSet] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Track current trail ID to prevent re-rendering on progress updates
  const currentTrailIdRef = useRef<string | null>(null);

  // Get MapTiler API key from environment
  const mapTilerKey = Constants.expoConfig?.extra?.mapTilerKey || process.env.EXPO_PUBLIC_MAPTILER_KEY || '';

  // Store initial location when GPS first gets a fix
  const initialLocation = useRef<typeof location>(null);
  
  // Capture the first location we get from GPS
  useEffect(() => {
    if (location && !initialLocation.current) {
      initialLocation.current = location;
      setInitialLocationSet(true);
    }
  }, [location]);

  // Center map on user location when we first get GPS fix
  useEffect(() => {
    if (initialLocationSet && mapReady && webViewRef.current && location) {
      const js = `
        if (window.map && window.userMarker && window.recenterMap) {
          var newLatLng = [${location.coords.latitude}, ${location.coords.longitude}];
          window.userMarker.setLatLng(newLatLng);
          window.recenterMap();
        }
      `;
      webViewRef.current.injectJavaScript(js);
    }
  }, [initialLocationSet, mapReady]);

  // Update marker position when location changes (but don't recenter map)
  useEffect(() => {
    if (location && mapReady && webViewRef.current) {
      const js = `
        if (window.map && window.userMarker) {
          var newLatLng = [${location.coords.latitude}, ${location.coords.longitude}];
          window.userMarker.setLatLng(newLatLng);
          // Don't call setView here - let user pan around freely
          // Only recenter when they click the recenter button
        }
      `;
      webViewRef.current.injectJavaScript(js);
    }
  }, [location, mapReady]);

  // Render active trail on map (only when trail changes, not on progress updates)
  useEffect(() => {
    if (!mapReady || !webViewRef.current) return;

    const newTrailId = activeTrail ? `${activeTrail.targetMarker.id}-${activeTrail.context}` : null;
    
    // Only update if trail actually changed (not just progress update)
    if (currentTrailIdRef.current === newTrailId) return;
    
    currentTrailIdRef.current = newTrailId;

    if (activeTrail) {
      // Draw trail (auto-zoom on first creation)
      const waypointsJson = JSON.stringify(activeTrail.route.waypoints);
      const isOffline = activeTrail.route.strategy === 'offline';
      const js = `
        if (window.drawTrail) {
          window.drawTrail(${waypointsJson}, '${activeTrail.color}', true, ${isOffline});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
      console.log('🗺️ Trail rendered on map');
    } else {
      // Clear trail
      const js = `
        if (window.clearTrail) {
          window.clearTrail();
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
      console.log('🗺️ Trail cleared from map');
    }
  }, [activeTrail, mapReady]);

  // Update trail as user moves (show remaining path from current position)
  useEffect(() => {
    if (!location || !activeTrail || !mapReady || !webViewRef.current) return;
    
    const currentPos = { lat: location.coords.latitude, lon: location.coords.longitude };
    const remainingWaypoints = getRemainingWaypoints(activeTrail.route.waypoints, currentPos);
    
    // Update trail to show only remaining path
    const waypointsJson = JSON.stringify(remainingWaypoints);
    const isOffline = activeTrail.route.strategy === 'offline';
    const js = `
      if (window.drawTrail) {
        window.drawTrail(${waypointsJson}, '${activeTrail.color}', false, ${isOffline});
      }
      true;
    `;
    webViewRef.current.injectJavaScript(js);
  }, [location, activeTrail, mapReady]);

  // Update user position on trail as they move
  useEffect(() => {
    if (location && activeTrail && mapReady && webViewRef.current) {
      const js = `
        if (window.updateUserMarkerOnTrail) {
          window.updateUserMarkerOnTrail(${location.coords.latitude}, ${location.coords.longitude});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
    }
  }, [location, activeTrail, mapReady]);

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
      console.error('Error parsing message from WebView:', e);
    }
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
        onSuccess: (marker) => {
          addMarkerToMap(marker);
          modals.closeAddMarker();
        },
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to save marker');
    }
  };

  // Handle voting on marker
  const onVote = (vote: 'agree' | 'disagree') => {
    // This is handled by the database context in MarkerDetailsModal
    // Just close the modal after voting
    modals.closeMarkerDetails();
  };

  // Add marker to Leaflet map
  const addMarkerToMap = (marker: Marker) => {
    if (!webViewRef.current || !mapReady) return;

    const markerHTML = generateMarkerHTML(marker.type, marker.confidenceScore);
    const markerHTMLEscaped = JSON.stringify(markerHTML);

    const js = 
      `(function() {
        if (!window.map) return;
        
        var markerHTML = ` + markerHTMLEscaped + `;
        
        var icon = L.divIcon({
          className: 'custom-marker',
          html: markerHTML,
          iconSize: [40, 50],
          iconAnchor: [20, 50],
          popupAnchor: [0, -50]
        });
        
        var marker = L.marker([` + marker.latitude + `, ` + marker.longitude + `], {
          icon: icon,
          markerId: '` + marker.id + `'
        }).addTo(window.map);
        
        marker.on('click', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'markerClick',
            markerId: '` + marker.id + `'
          }));
        });
        
        window.safePathMarkers['` + marker.id + `'] = marker;
      })();`;
    
    webViewRef.current.injectJavaScript(js);
  };

  // Clear all markers from map
  const clearAllMarkers = () => {
    if (!webViewRef.current || !mapReady) return;

    const js = `
      (function() {
        if (!window.map || !window.safePathMarkers) return;
        
        // Remove all markers from map
        Object.values(window.safePathMarkers).forEach(function(marker) {
          window.map.removeLayer(marker);
        });
        
                
        // Clear the markers object
        window.safePathMarkers = {};
      })();
    `;
    
    webViewRef.current.injectJavaScript(js);
  };

  // Add SOS marker to Leaflet map
  const addSOSMarkerToMap = (sosMarker: SOSMarker) => {
    if (!webViewRef.current || !mapReady) return;

    const markerHTML = generateMarkerHTML('sos' as MarkerType, 100, sosMarker.status);
    const markerHTMLEscaped = JSON.stringify(markerHTML);

    const js = `
      (function() {
        if (!window.map) return;
        
        // Initialize SOS markers object if needed
        if (!window.sosMarkers) {
          window.sosMarkers = {};
        }
        
        var markerHTML = ` + markerHTMLEscaped + `;
        
        var icon = L.divIcon({
          className: 'custom-marker sos-marker',
          html: markerHTML,
          iconSize: [48, 58],
          iconAnchor: [24, 58],
          popupAnchor: [0, -58]
        });
        
        var marker = L.marker([` + sosMarker.latitude + `, ` + sosMarker.longitude + `], {
          icon: icon,
          markerId: '` + sosMarker.id + `',
          markerType: 'sos'
        }).addTo(window.map);
        
        marker.on('click', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'sosMarkerClick',
            sosMarkerId: '` + sosMarker.id + `'
          }));
        });
        
        window.sosMarkers['` + sosMarker.id + `'] = marker;
      })();
    `;
    
    webViewRef.current.injectJavaScript(js);
  };

  // Clear all SOS markers from map
  const clearSOSMarkers = () => {
    if (!webViewRef.current || !mapReady) return;

    const js = `
      (function() {
        if (!window.map || !window.sosMarkers) return;
        
        // Remove all SOS markers from map
        Object.values(window.sosMarkers).forEach(function(marker) {
          window.map.removeLayer(marker);
        });
        
        // Clear the SOS markers object
        window.sosMarkers = {};
      })();
    `;
    
    webViewRef.current.injectJavaScript(js);
  };

  // Refresh all markers on map
  const refreshMapMarkers = () => {
    console.log('Refreshing markers on map: ' + markers.length);
    clearAllMarkers();
    setTimeout(() => {
      markers.forEach(marker => addMarkerToMap(marker));
      console.log('Added markers on map: ' + markers.length);
    }, 100); // Small delay to ensure clear completes
  };

  // Load existing markers when map is ready
  useEffect(() => {
    if (mapReady && markers.length > 0) {
      markers.forEach(marker => addMarkerToMap(marker));
    }
  }, [mapReady]);

  // Load SOS markers when map is ready
  useEffect(() => {
    if (mapReady && activeSOSMarkers.length > 0) {
      activeSOSMarkers.forEach(sosMarker => addSOSMarkerToMap(sosMarker));
    }
  }, [mapReady, activeSOSMarkers.length]);

  // Update markers on map when markers change (e.g., after sync)
  useEffect(() => {
    if (mapReady && !refreshing) {
      // Don't refresh during manual sync (we handle it explicitly there)
      refreshMapMarkers();
    }
  }, [markers.length, mapReady]);

  // Update SOS markers on map when they change
  useEffect(() => {
    if (mapReady) {
      console.log('🗺️ Updating SOS markers on map:', activeSOSMarkers.length);
      // Clear existing SOS markers
      clearSOSMarkers();
      // Re-add all SOS markers
      activeSOSMarkers.forEach(sosMarker => {
        console.log('➕ Adding SOS marker to map:', sosMarker.id);
        addSOSMarkerToMap(sosMarker);
      });
    }
  }, [activeSOSMarkers, mapReady]);



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
      console.error('❌ Manual sync failed:', error);
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
