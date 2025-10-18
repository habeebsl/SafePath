import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';

interface UseMapUserLocationOptions {
  webViewRef: React.RefObject<any>;
  mapReady: boolean;
  location?: Location.LocationObject | null;
}

export function useMapUserLocation({
  webViewRef,
  mapReady,
  location,
}: UseMapUserLocationOptions) {
  const lastUpdateTime = useRef<number>(0);
  const lastCoords = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!location || !mapReady || !webViewRef.current) return;

    const now = Date.now();
    const newLat = location.coords.latitude;
    const newLng = location.coords.longitude;

    // Throttle updates to max once every 2 seconds
    if (now - lastUpdateTime.current < 2000) return;

    // Only update if position changed significantly (more than ~5 meters)
    if (lastCoords.current) {
      const latDiff = Math.abs(newLat - lastCoords.current.lat);
      const lngDiff = Math.abs(newLng - lastCoords.current.lng);
      
      // Skip update if change is less than ~5 meters (~0.00005 degrees)
      if (latDiff < 0.00005 && lngDiff < 0.00005) return;
    }

    // Update the marker
    const js = `
      if (window.map && window.userMarker) {
        window.userMarker.setLngLat([${newLng}, ${newLat}]);
      }
    `;
    webViewRef.current.injectJavaScript(js);

    // Remember last update
    lastUpdateTime.current = now;
    lastCoords.current = { lat: newLat, lng: newLng };
  }, [location, mapReady, webViewRef]);
}