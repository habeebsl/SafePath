import { Trail } from '@/types/trail';
import { uiLogger } from '@/utils/logger';
import { getRemainingWaypoints } from '@/utils/trail-helpers';
import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';

interface UseMapTrailOptions {
  webViewRef: React.RefObject<any>;
  mapReady: boolean;
  activeTrail?: Trail | null;
  location?: Location.LocationObject | null;
}

export function useMapTrail({ webViewRef, mapReady, activeTrail, location }: UseMapTrailOptions) {
  // Track current trail ID to prevent re-rendering on progress updates
  const currentTrailIdRef = useRef<string | null>(null);

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
      
      // Calculate initial bearing if we have location
      let initialBearingJS = '';
      if (location) {
        const currentPos = { lat: location.coords.latitude, lon: location.coords.longitude };
        const remainingWaypoints = getRemainingWaypoints(activeTrail.route.waypoints, currentPos);
        
        if (remainingWaypoints.length > 1) {
          const nextWaypoint = remainingWaypoints[1];
          initialBearingJS = `
            if (window.updateNavigationBearing) {
              window.updateNavigationBearing(${location.coords.latitude}, ${location.coords.longitude}, ${nextWaypoint.lat}, ${nextWaypoint.lon});
            }
          `;
        }
      }
      
      const js = `
        if (window.drawTrail) {
          window.drawTrail(${waypointsJson}, '${activeTrail.color}', true, ${isOffline});
        }
        if (window.enableNavigationMode) {
          window.enableNavigationMode('${activeTrail.color}');
        }
        ${initialBearingJS}
        true;
      `;
      webViewRef.current.injectJavaScript(js);
      uiLogger.info('🗺️ Trail rendered on map with navigation mode');
    } else {
      // Clear trail and disable navigation mode
      const js = `
        if (window.clearTrail) {
          window.clearTrail();
        }
        if (window.disableNavigationMode) {
          window.disableNavigationMode();
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
      uiLogger.info('🗺️ Trail cleared from map, navigation mode disabled');
    }
  }, [activeTrail, mapReady, webViewRef, location]);
}