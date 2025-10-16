import { useEffect } from 'react';
import { getRemainingWaypoints } from '@/utils/trail-helpers';
import { uiLogger } from '@/utils/logger';
import { Trail } from '@/types/trail';

interface UseMapTrailProgressAndUserMarkerOptions {
  location: any;
  activeTrail: Trail | null;
  mapReady: boolean;
  mapRef: any;
  trailPolylineRef: any;
  userMarkerOnTrailRef: any;
}

export function useMapTrailProgressAndUserMarker({
  location,
  activeTrail,
  mapReady,
  mapRef,
  trailPolylineRef,
  userMarkerOnTrailRef,
}: UseMapTrailProgressAndUserMarkerOptions) {
  // Update trail as user moves (show remaining path from current position)
  useEffect(() => {
    if (!location || !activeTrail || !mapReady || !mapRef.current || !window.L) return;

    const currentPos = { lat: location.coords.latitude, lon: location.coords.longitude };
    const remainingWaypoints = getRemainingWaypoints(activeTrail.route.waypoints, currentPos);
    const isOffline = activeTrail.route.strategy === 'offline';

    // Update trail to show only remaining path
    if (trailPolylineRef.current) {
      mapRef.current.removeLayer(trailPolylineRef.current);
    }

    trailPolylineRef.current = window.L.polyline(
      remainingWaypoints.map((wp: any) => [wp.lat, wp.lon]),
      {
        color: activeTrail.color,
        weight: 4,
        opacity: isOffline ? 0.6 : 0.8,
        lineJoin: 'round',
        lineCap: 'round',
        dashArray: isOffline ? '10, 10' : undefined
      }
    ).addTo(mapRef.current);

    // Update user position on trail as they move
    if (userMarkerOnTrailRef.current) {
      userMarkerOnTrailRef.current.setLatLng([location.coords.latitude, location.coords.longitude]);
    } else {
      userMarkerOnTrailRef.current = window.L.circleMarker([location.coords.latitude, location.coords.longitude], {
        radius: 10,
        color: '#FFFFFF',
        fillColor: '#007AFF',
        fillOpacity: 1,
        weight: 3
      }).addTo(mapRef.current);
    }

    uiLogger.debug('Trail progress and user marker updated');
  }, [location, activeTrail, mapReady]);
}