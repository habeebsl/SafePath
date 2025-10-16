import { useEffect, useState, useRef } from 'react';
import { LocationObject } from 'expo-location';

interface UseMapInstanceOptions {
  webViewRef: React.RefObject<any>;
  location?: LocationObject | null;
}

export function useMapInstance({ webViewRef, location }: UseMapInstanceOptions) {
  const [mapReady, setMapReady] = useState(false);
  const [initialLocationSet, setInitialLocationSet] = useState(false);
  const initialLocation = useRef<LocationObject | null>(null);

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
  }, [initialLocationSet, mapReady, webViewRef]);

  return { 
    mapReady,
    setMapReady,
    initialLocation
 };
}