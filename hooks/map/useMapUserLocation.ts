import { useEffect } from 'react';
import * as Location from 'expo-location';

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
  useEffect(() => {
    if (location && mapReady && webViewRef.current) {
      const js = `
        if (window.map && window.userMarker) {
          var newLatLng = [${location.coords.latitude}, ${location.coords.longitude}];
          window.userMarker.setLatLng(newLatLng);
        }
      `;
      webViewRef.current.injectJavaScript(js);
    }
  }, [location, mapReady, webViewRef]);
}