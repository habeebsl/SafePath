import React, { useRef, useEffect, useState, useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { useLocation } from '@/contexts/LocationContext';
import region from '@/config/region.json';
import Constants from 'expo-constants';
import { AddMarkerModal } from './markers/AddMarkerModal';
import { MarkerDetailsModal } from './markers/MarkerDetailsModal';
import { MarkerType, Marker } from '@/types/marker';
import { MARKER_CONFIG } from '@/constants/marker-icons';
import { Icon } from '@/components/Icon';

export default function MapComponent() {
  const { location, isTracking } = useLocation();
  const webViewRef = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);
  const [initialLocationSet, setInitialLocationSet] = useState(false);

  // Modal state
  const [showAddMarker, setShowAddMarker] = useState(false);
  const [showMarkerDetails, setShowMarkerDetails] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null);
  
  // Temporary: Store markers in state (will move to database later)
  const [markers, setMarkers] = useState<Marker[]>([]);

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
          box-shadow: 0 1px 5px rgba(0,0,0,0.4);
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
  const handleSaveMarker = (data: {
    type: MarkerType;
    title: string;
    description: string;
    latitude: number;
    longitude: number;
  }) => {
    const newMarker: Marker = {
      id: `marker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: data.type,
      latitude: data.latitude,
      longitude: data.longitude,
      title: data.title,
      description: data.description,
      createdBy: 'local_device', // TODO: Replace with actual device ID
      createdAt: Date.now(),
      lastVerified: Date.now(),
      agrees: 1,
      disagrees: 0,
      confidenceScore: 100,
      syncedToServer: false,
    };

    // Add to state
    setMarkers(prev => [...prev, newMarker]);
    
    // Add to map
    addMarkerToMap(newMarker);
    
    // Close modal
    setShowAddMarker(false);
    setSelectedLocation(null);
  };

  // Handle voting on marker
  const handleVote = (vote: 'agree' | 'disagree') => {
    if (!selectedMarker) return;

    // Update marker
    setMarkers(prev => prev.map(m => {
      if (m.id === selectedMarker.id) {
        const updated = {
          ...m,
          agrees: vote === 'agree' ? m.agrees + 1 : m.agrees,
          disagrees: vote === 'disagree' ? m.disagrees + 1 : m.disagrees,
          lastVerified: Date.now(),
        };
        
        // Recalculate confidence
        const totalVotes = updated.agrees + updated.disagrees;
        const agreeRatio = updated.agrees / totalVotes;
        updated.confidenceScore = Math.round(agreeRatio * 100);
        
        return updated;
      }
      return m;
    }));

    // TODO: Store vote in database to prevent duplicate votes
    
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

  // Load existing markers when map is ready
  useEffect(() => {
    if (mapReady && markers.length > 0) {
      markers.forEach(marker => addMarkerToMap(marker));
    }
  }, [mapReady]);

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
