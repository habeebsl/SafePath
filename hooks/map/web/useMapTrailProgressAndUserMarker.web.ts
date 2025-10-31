import { Trail } from '@/types/trail';
import { uiLogger } from '@/utils/logger';
import { getRemainingWaypoints } from '@/utils/trail-helpers';
import maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';

interface UseMapTrailProgressAndUserMarkerOptions {
  map: maplibregl.Map | null;
  mapReady: boolean;
  location: any;
  activeTrail: Trail | null;
}

export function useMapTrailProgressAndUserMarker({
  map,
  mapReady,
  location,
  activeTrail,
}: UseMapTrailProgressAndUserMarkerOptions) {
  const lastUpdateTime = useRef<number>(0);

  // Update trail as user moves (show remaining path from current position)
  useEffect(() => {
    if (!location || !activeTrail || !mapReady || !map) return;

    const now = Date.now();
    // Throttle trail updates to once every 2 seconds
    if (now - lastUpdateTime.current < 2000) return;

    const currentPos = { lat: location.coords.latitude, lon: location.coords.longitude };
    const remainingWaypoints = getRemainingWaypoints(activeTrail.route.waypoints, currentPos);

    // Update trail GeoJSON source to show only remaining path
    const source = map.getSource('trail') as maplibregl.GeoJSONSource;
    if (source) {
      const coordinates = remainingWaypoints.map(wp => [wp.lon, wp.lat]);
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates,
        },
      });
      uiLogger.debug('🗺️ Trail progress updated:', coordinates.length, 'remaining waypoints');
    }
    
    lastUpdateTime.current = now;
  }, [location, activeTrail, mapReady, map]);

  // Don't show a separate trail progress marker - the main user marker is enough
  // This prevents the duplicate marker issue (marker is handled by useMapUserLocation.web.ts)
}