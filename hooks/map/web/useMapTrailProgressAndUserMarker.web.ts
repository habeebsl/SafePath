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
  const userMarkerOnTrailRef = useRef<maplibregl.Marker | null>(null);

  // Update trail as user moves (show remaining path from current position)
  useEffect(() => {
    if (!location || !activeTrail || !mapReady || !map) {
      // Clean up user marker on trail if no active trail
      if (userMarkerOnTrailRef.current && !activeTrail) {
        userMarkerOnTrailRef.current.remove();
        userMarkerOnTrailRef.current = null;
        uiLogger.debug('Trail user marker removed');
      }
      return;
    }

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
      uiLogger.debug('Trail progress updated:', coordinates.length, 'remaining waypoints');
    } else {
      uiLogger.warn('⚠️ Trail source not found, waiting for useMapTrail to create it');
    }

    // Update user position marker on trail
    if (userMarkerOnTrailRef.current) {
      userMarkerOnTrailRef.current.setLngLat([
        location.coords.longitude,
        location.coords.latitude,
      ]);
    } else {
      // Create user marker on trail
      const el = document.createElement('div');
      el.className = 'user-marker-on-trail';
      el.style.width = '20px';
      el.style.height = '20px';
      el.style.backgroundColor = '#007AFF';
      el.style.border = '3px solid #FFFFFF';
      el.style.borderRadius = '50%';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';

      userMarkerOnTrailRef.current = new maplibregl.Marker({
        element: el,
      })
        .setLngLat([location.coords.longitude, location.coords.latitude])
        .addTo(map);
    }

    uiLogger.debug('Trail progress and user marker updated');
  }, [location, activeTrail, mapReady, map]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (userMarkerOnTrailRef.current) {
        userMarkerOnTrailRef.current.remove();
        userMarkerOnTrailRef.current = null;
      }
    };
  }, []);
}