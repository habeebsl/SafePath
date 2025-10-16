import { useEffect, useRef } from 'react';
import { uiLogger } from '@/utils/logger';
import { Trail } from '@/types/trail';

interface UseMapTrailOptions {
  activeTrail: Trail | null;
  mapReady: boolean;
  mapRef: any;
}

export function useMapTrail({ activeTrail, mapReady, mapRef }: UseMapTrailOptions) {
  const trailPolylineRef = useRef<any>(null);
  const currentTrailIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const newTrailId = activeTrail ? `${activeTrail.targetMarker.id}-${activeTrail.context}` : null;

    // Only update if trail actually changed (not just progress update)
    if (currentTrailIdRef.current === newTrailId) return;

    currentTrailIdRef.current = newTrailId;

    if (activeTrail) {
      // Draw trail (auto-zoom on first creation)
      const waypoints = activeTrail.route.waypoints;
      const isOffline = activeTrail.route.strategy === 'offline';

      // Remove existing trail
      if (trailPolylineRef.current) {
        mapRef.current.removeLayer(trailPolylineRef.current);
      }

      // Draw trail polyline with different style for offline routes
      trailPolylineRef.current = window.L.polyline(
        waypoints.map((wp: any) => [wp.lat, wp.lon]),
        {
          color: activeTrail.color,
          weight: 4,
          opacity: isOffline ? 0.6 : 0.8,
          lineJoin: 'round',
          lineCap: 'round',
          dashArray: isOffline ? '10, 10' : undefined
        }
      ).addTo(mapRef.current);

      // Auto-zoom to show entire trail on initial creation
      mapRef.current.fitBounds(trailPolylineRef.current.getBounds(), {
        padding: [50, 50],
        maxZoom: 16
      });

      uiLogger.info('🗺️ Trail rendered on map');
    } else {
      // Clear trail
      if (trailPolylineRef.current) {
        mapRef.current.removeLayer(trailPolylineRef.current);
        trailPolylineRef.current = null;
      }
      uiLogger.info('🗺️ Trail cleared from map');
    }
  }, [activeTrail, mapReady, mapRef]);

  return {
    trailPolylineRef,
  };
}