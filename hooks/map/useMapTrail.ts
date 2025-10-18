import { useEffect, useRef } from 'react';
import { Trail } from '@/types/trail';
import { uiLogger } from '@/utils/logger';

interface UseMapTrailOptions {
  webViewRef: React.RefObject<any>;
  mapReady: boolean;
  activeTrail?: Trail | null;
}

export function useMapTrail({ webViewRef, mapReady, activeTrail }: UseMapTrailOptions) {
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
      const js = `
        if (window.drawTrail) {
          window.drawTrail(${waypointsJson}, '${activeTrail.color}', true, ${isOffline});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
      uiLogger.info('🗺️ Trail rendered on map');
    } else {
      // Clear trail
      const js = `
        if (window.clearTrail) {
          window.clearTrail();
        }
        true;
      `;
      webViewRef.current.injectJavaScript(js);
      uiLogger.info('🗺️ Trail cleared from map');
    }
  }, [activeTrail, mapReady, webViewRef]);
}