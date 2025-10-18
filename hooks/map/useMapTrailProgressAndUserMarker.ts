import { Trail } from '@/types/trail';
import { getRemainingWaypoints } from '@/utils/trail-helpers';
import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';

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
  const lastUpdateTime = useRef<number>(0);

  // Update trail as user moves (show remaining path from current position)
  useEffect(() => {
    if (!location || !activeTrail || !mapReady || !webViewRef.current) return;

    const now = Date.now();
    // Throttle trail updates to once every 2 seconds
    if (now - lastUpdateTime.current < 2000) return;

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
    
    lastUpdateTime.current = now;
  }, [location, activeTrail, mapReady, webViewRef]);

  // Don't show a separate trail progress marker - the main user marker is enough
  // Removing the duplicate marker that was causing the "stacked dot" issue
}