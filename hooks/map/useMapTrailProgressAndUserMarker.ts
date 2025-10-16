import { useEffect } from 'react';
import { Trail } from '@/types/trail';
import * as Location from 'expo-location';
import { getRemainingWaypoints } from '@/utils/trail-helpers';

interface UseMapTrailProgressAndUserMarkerOptions {
  webViewRef: React.RefObject<any>;
  mapReady: boolean;
  activeTrail?: Trail | null;
  location?: Location.LocationObject | null;
}

export function useMapTrailProgressAndUserMarker({
  webViewRef,
  mapReady,
  activeTrail,
  location,
}: UseMapTrailProgressAndUserMarkerOptions) {
  // Update trail as user moves (show remaining path from current position)
  useEffect(() => {
    if (!location || !activeTrail || !mapReady || !webViewRef.current) return;

    const currentPos = { lat: location.coords.latitude, lon: location.coords.longitude };
    const remainingWaypoints = getRemainingWaypoints(activeTrail.route.waypoints, currentPos);

    const waypointsJson = JSON.stringify(remainingWaypoints);
    const isOffline = activeTrail.route.strategy === 'offline';
    const js = `
      if (window.drawTrail) {
        window.drawTrail(${waypointsJson}, '${activeTrail.color}', false, ${isOffline});
      }
      true;
    `;
    webViewRef.current.injectJavaScript(js);
  }, [location, activeTrail, mapReady, webViewRef]);

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
  }, [location, activeTrail, mapReady, webViewRef]);
}