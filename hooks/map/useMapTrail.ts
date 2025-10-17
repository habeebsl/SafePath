import { Trail } from '@/types/trail';
import Mapbox from '@rnmapbox/maps';
import { useEffect, useMemo, useRef } from 'react';

interface UseMapTrailOptions {
  mapRef: React.RefObject<Mapbox.MapView | null>;
  mapReady: boolean;
  activeTrail?: Trail | null;
}

export function useMapTrail({ mapRef, mapReady, activeTrail }: UseMapTrailOptions) {
  // Track current trail ID to prevent re-rendering on progress updates
  const currentTrailIdRef = useRef<string | null>(null);

  // Convert trail waypoints to GeoJSON LineString
  const trailGeoJSON = useMemo(() => {
    if (!activeTrail || !activeTrail.route.waypoints || activeTrail.route.waypoints.length === 0) {
      return null;
    }

    return {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: activeTrail.route.waypoints.map(wp => [wp.lon, wp.lat]),
      },
      properties: {
        color: activeTrail.color,
        strategy: activeTrail.route.strategy,
      },
    };
  }, [activeTrail]);

  // Track trail changes
  useEffect(() => {
    const newTrailId = activeTrail ? `${activeTrail.targetMarker.id}-${activeTrail.context}` : null;
    currentTrailIdRef.current = newTrailId;
  }, [activeTrail]);

  return {
    trailGeoJSON,
  };
}