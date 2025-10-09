import { Icon } from '@/components/Icon';
import { TrailBottomBar } from '@/components/trail/TrailBottomBar';
import region from '@/config/region.json';
import { MARKER_CONFIG } from '@/constants/marker-icons';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useLocation } from '@/contexts/LocationContext';
import { useTrail } from '@/contexts/TrailContext';
import { Marker, MarkerType } from '@/types/marker';
import NetInfo from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { AddMarkerModal } from './markers/AddMarkerModal';
import { MarkerDetailsModal } from './markers/MarkerDetailsModal';

export default function MapComponent() {
  const { location, isTracking } = useLocation();
  const { markers, addMarker: dbAddMarker, isReady: dbReady, refreshMarkers, triggerSync, deviceId } = useDatabase();
  const { activeTrail } = useTrail();
  const webViewRef = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [initialLocationSet, setInitialLocationSet] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  
  // Track current trail ID to prevent re-rendering on progress updates
  const currentTrailIdRef = useRef<string | null>(null);

  // Modal state
  const [showAddMarker, setShowAddMarker] = useState(false);
  const [showMarkerDetails, setShowMarkerDetails] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null);

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

  // Monitor network connectivity status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
    });

    // Get initial network state
    NetInfo.fetch().then(state => {
      setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
    });

    return () => unsubscribe();
  }, []);

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
    const waypoints = activeTrail.route.waypoints;
    
    // Find closest waypoint to current position
    let closestIndex = 0;
    let minDistance = Infinity;
    
    waypoints.forEach((point, index) => {
      const dx = point.lat - currentPos.lat;
      const dy = point.lon - currentPos.lon;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = index;
      }
    });
    
    // Create remaining waypoints: current position + waypoints ahead
    const remainingWaypoints = [
      currentPos,
      ...waypoints.slice(closestIndex + 1)
    ];
    
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

        // Store markers globally for click handling
        window.safePathMarkers = {};
      </script>
    </body>
    </html>
  `;
  }, [mapTilerKey, initialLocationSet]); // Recreate once when initial location is set

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'mapReady') {
        setMapReady(true);
      } else if (data.type === 'addMarker') {
        // Long-press detected - show add marker modal
        setSelectedLocation({ lat: data.lat, lng: data.lng });
        setShowAddMarker(true);
      } else if (data.type === 'markerClick') {
        // Marker clicked - show details modal
        const marker = markers.find(m => m.id === data.markerId);
        if (marker) {
          setSelectedMarker(marker);
          setShowMarkerDetails(true);
        }
      }
    } catch (e) {
      console.error('Error parsing message from WebView:', e);
    }
  };

  // Handle saving new marker
  const handleSaveMarker = async (data: {
    type: MarkerType;
    title: string;
    description: string;
    latitude: number;
    longitude: number;
  }) => {
    // Check if database is ready
    if (!dbReady) {
      alert('Database is still initializing. Please wait a moment and try again.');
      return;
    }

    try {
      console.log('🗺️ Saving new marker...');
      const newMarker: Marker = {
        id: `marker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: data.type,
        latitude: data.latitude,
        longitude: data.longitude,
        title: data.title,
        description: data.description,
        createdBy: deviceId || 'unknown_device',
        createdAt: Date.now(),
        lastVerified: Date.now(),
        agrees: 1,
        disagrees: 0,
        confidenceScore: 100,
        syncedToServer: false,
      };

      // Add to database (will automatically sync to cloud when online)
      await dbAddMarker(newMarker);
      
      // Add to map
      addMarkerToMap(newMarker);
      
      // Close modal
      setShowAddMarker(false);
      setSelectedLocation(null);
    } catch (error) {
      console.error('Error saving marker:', error);
      alert(`Failed to save marker: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Handle voting on marker - delegated to MarkerDetailsModal
  const handleVote = (vote: 'agree' | 'disagree') => {
    // This is now handled by the database context in MarkerDetailsModal
    // Just close the modal after voting
    setShowMarkerDetails(false);
    setSelectedMarker(null);
  };

  // Add marker to Leaflet map
  const addMarkerToMap = (marker: Marker) => {
    if (!webViewRef.current || !mapReady) return;

    const js = `
      (function() {
        if (!window.map) return;
        
        // Import marker HTML generator (inline for now)
        var markerHTML = ${JSON.stringify(generateMarkerHTML(marker))};
        
        var icon = L.divIcon({
          className: 'custom-marker',
          html: markerHTML,
          iconSize: [40, 50],
          iconAnchor: [20, 50],
          popupAnchor: [0, -50]
        });
        
        var marker = L.marker([${marker.latitude}, ${marker.longitude}], {
          icon: icon,
          markerId: '${marker.id}'
        }).addTo(window.map);
        
        marker.on('click', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'markerClick',
            markerId: '${marker.id}'
          }));
        });
        
        window.safePathMarkers['${marker.id}'] = marker;
      })();
    `;
    
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

  // Refresh all markers on map
  const refreshMapMarkers = () => {
    if (!mapReady) return;
    
    console.log('🗺️ Refreshing map markers...');
    clearAllMarkers();
    
    // Re-add all markers
    setTimeout(() => {
      markers.forEach(marker => addMarkerToMap(marker));
      console.log(`✅ Refreshed ${markers.length} markers on map`);
    }, 100); // Small delay to ensure clear completes
  };

  // Load existing markers when map is ready
  useEffect(() => {
    if (mapReady && markers.length > 0) {
      markers.forEach(marker => addMarkerToMap(marker));
    }
  }, [mapReady]);

  // Update markers on map when markers change (e.g., after sync)
  useEffect(() => {
    if (mapReady && !refreshing) {
      // Don't refresh during manual sync (we handle it explicitly there)
      refreshMapMarkers();
    }
  }, [markers.length, mapReady]);

  // Helper function to generate marker HTML (inline version)
  const generateMarkerHTML = (marker: Marker): string => {
    const config = MARKER_CONFIG[marker.type];
    const { color, size, iconSvg } = config;
    
    // Adjust opacity based on confidence
    let bgColor = color;
    if (marker.confidenceScore < 80) bgColor = `${color}CC`;
    if (marker.confidenceScore < 50) bgColor = `${color}99`;
    if (marker.confidenceScore < 20) bgColor = `${color}66`;
    
    return `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background: ${bgColor};
        border: 3px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 3px 8px rgba(0,0,0,0.4);
      ">
        <div style="
          transform: rotate(45deg);
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          ${iconSvg}
        </div>
      </div>
    `;
  };

  const getMarkerConfig = (type: MarkerType) => {
    const configs = {
      safe: { color: '#22C55E', size: 40 },
      danger: { color: '#EF4444', size: 40 },
      uncertain: { color: '#F59E0B', size: 38 },
      medical: { color: '#3B82F6', size: 42 },
      food: { color: '#92400E', size: 38 },
      shelter: { color: '#7C3AED', size: 38 },
      checkpoint: { color: '#64748B', size: 38 },
      combat: { color: '#DC2626', size: 42 },
    };
    return configs[type] || configs.danger;
  };

  // Handle manual sync
  const handleManualSync = async () => {
    setRefreshing(true);
    try {
      console.log('🔄 Starting manual sync...');
      
      // Trigger sync with cloud
      await triggerSync();
      
      // Refresh markers from database
      await refreshMarkers();
      
      // Refresh markers on the map
      refreshMapMarkers();
      
      console.log('✅ Manual sync completed');
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

      {/* Region badge */}
      <View style={styles.regionBadge}>
        <Icon name="map-marker-alt" size={12} color="#fff" style={styles.badgeIcon} />
        <Text style={styles.regionText}>{region.displayName}</Text>
      </View>

      {/* Tracking status */}
      {isTracking && (
        <View style={styles.trackingBadge}>
          <View style={styles.trackingDot} />
          <Text style={styles.trackingText}>Tracking</Text>
        </View>
      )}

      {/* Sync Button */}
      {dbReady && (
        <View style={styles.syncButtonContainer}>
          <TouchableOpacity
            style={styles.syncButton}
            onPress={handleManualSync}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon name="sync-alt" size={16} color="#fff" />
            )}
            
            {/* Network Status Dot */}
            {!refreshing && (
              <View style={[styles.statusDot, isOnline ? styles.statusOnline : styles.statusOffline]} />
            )}
          </TouchableOpacity>
          
          {/* Network Status Text */}
          <View style={[styles.statusTextContainer, isOnline ? styles.statusTextOnline : styles.statusTextOffline]}>
            <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
          </View>
        </View>
      )}

      {/* Current location info */}
      {location && (
        <View style={styles.locationInfo}>
          <View style={styles.locationTextContainer}>
            <View style={styles.coordinatesRow}>
              <Icon name="map-marker-alt" size={14} color="#fff" style={styles.locationIcon} />
              <Text style={styles.locationText}>
                {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
              </Text>
            </View>
            <Text style={styles.accuracyText}>
              ±{location.coords.accuracy?.toFixed(0)}m
            </Text>
          </View>
        </View>
      )}

      {/* Database status indicator */}
      {!dbReady && (
        <View style={styles.dbStatusContainer}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.dbStatusText}>Initializing database...</Text>
        </View>
      )}

      {/* Add Marker Modal */}
      {selectedLocation && (
        <AddMarkerModal
          visible={showAddMarker}
          latitude={selectedLocation.lat}
          longitude={selectedLocation.lng}
          onClose={() => {
            setShowAddMarker(false);
            setSelectedLocation(null);
          }}
          onSave={handleSaveMarker}
        />
      )}

      {/* Marker Details Modal */}
      <MarkerDetailsModal
        visible={showMarkerDetails}
        marker={selectedMarker}
        userVote={null} // TODO: Check if user already voted
        onClose={() => {
          setShowMarkerDetails(false);
          setSelectedMarker(null);
        }}
        onVote={handleVote}
      />

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
  regionBadge: {
    position: 'absolute',
    top: 60,
    left: 10,
    backgroundColor: 'rgba(231, 76, 60, 0.9)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeIcon: {
    marginRight: 0,
  },
  regionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  trackingBadge: {
    position: 'absolute',
    top: 100,
    left: 10,
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  trackingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CD964',
  },
  trackingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  syncButtonContainer: {
    position: 'absolute',
    top: 60,
    right: 10,
    alignItems: 'center',
  },
  syncButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  statusDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.9)', // Match sync button background
  },
  statusOnline: {
    backgroundColor: '#22C55E', // Green
  },
  statusOffline: {
    backgroundColor: '#EF4444', // Red
  },
  statusTextContainer: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusTextOnline: {
    backgroundColor: 'rgba(34, 197, 94, 0.9)', // Green
  },
  statusTextOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.9)', // Red
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  dbStatusContainer: {
    position: 'absolute',
    top: 110,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  dbStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  locationInfo: {
    position: 'absolute',
    bottom: 20,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationIcon: {
    marginRight: 0,
  },
  locationTextContainer: {
    flex: 1,
    flexDirection: 'column'
  },
  coordinatesRow: {
    gap: 5,
    flexDirection: 'row',
    alignItems: 'center'
  },
  locationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  accuracyText: {
    color: '#aaa',
    fontSize: 12,
  },
});
