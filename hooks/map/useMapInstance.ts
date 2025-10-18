import { LocationObject } from 'expo-location';
import { useEffect, useRef, useState } from 'react';

interface UseMapInstanceOptions {
  webViewRef: React.RefObject<any>;
  location?: LocationObject | null;
}

export function useMapInstance({ webViewRef, location }: UseMapInstanceOptions) {
  const [mapReady, setMapReady] = useState(false);
  const [initialLocationSet, setInitialLocationSet] = useState(false);
  const initialLocation = useRef<LocationObject | null>(null);
  const hasRecentered = useRef(false);  // Track if we've already recentered

  // Capture the first location we get from GPS
  useEffect(() => {
    if (location && !initialLocation.current) {
      initialLocation.current = location;
      setInitialLocationSet(true);
    }
  }, [location]);

  // Center map on user location when we first get GPS fix (ONLY ONCE)
  useEffect(() => {
    if (initialLocationSet && mapReady && webViewRef.current && location && !hasRecentered.current) {
      const js = `
        if (window.map && window.userMarker && window.recenterMap) {
          // MapLibre Marker API expects [lng, lat]
          window.userMarker.setLngLat([${location.coords.longitude}, ${location.coords.latitude}]);
          window.recenterMap();
        }
      `;
      webViewRef.current.injectJavaScript(js);
      hasRecentered.current = true;  // Mark as recentered
    }
  }, [initialLocationSet, mapReady, webViewRef]);

  return { 
    mapReady,
    setMapReady,
    initialLocation
 };
}