import { Trail } from '@/types/trail';
import { getRemainingWaypoints } from '@/utils/trail-helpers';
import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';
import { useMemo } from 'react';

interface UseMapTrailProgressAndUserMarkerOptions {
  mapRef: React.RefObject<Mapbox.MapView | null>;
  mapReady: boolean;
  activeTrail?: Trail | null;
  location?: Location.LocationObject | null;
}

export function useMapTrailProgressAndUserMarker({
  mapRef,
  mapReady,
  activeTrail,
  location,
}: UseMapTrailProgressAndUserMarkerOptions) {
  // Calculate remaining trail from current position
  const remainingTrailGeoJSON = useMemo(() => {
    if (!location || !activeTrail || !activeTrail.route.waypoints || activeTrail.route.waypoints.length === 0) {
      return null;
    }

    const currentPos = { lat: location.coords.latitude, lon: location.coords.longitude };
    const remainingWaypoints = getRemainingWaypoints(activeTrail.route.waypoints, currentPos);

    if (remainingWaypoints.length === 0) {
      return null;
    }

    return {
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: remainingWaypoints.map(wp => [wp.lon, wp.lat]),
      },
      properties: {
        color: activeTrail.color,
        isRemaining: true,
      },
    };
  }, [location, activeTrail]);

  return {
    remainingTrailGeoJSON,
  };
}