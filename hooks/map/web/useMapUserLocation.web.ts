import { uiLogger } from '@/utils/logger';
import maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';

interface UseMapUserLocationOptions {
  map: maplibregl.Map | null;
  mapReady: boolean;
  location: any; // From LocationContext
}

export function useMapUserLocation({ map, mapReady, location }: UseMapUserLocationOptions) {
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);

  // Create user marker when map is ready (once)
  useEffect(() => {
    if (!mapReady || !map) return;

    // Create custom user marker element
    const el = document.createElement('div');
    el.className = 'user-marker';
    el.style.width = '20px';
    el.style.height = '20px';
    el.style.backgroundColor = '#007AFF';
    el.style.border = '3px solid white';
    el.style.borderRadius = '50%';
    el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';

    // Create marker (will be positioned when location is available)
    const initialPos = location 
      ? [location.coords.longitude, location.coords.latitude]
      : [0, 0];

    userMarkerRef.current = new maplibregl.Marker({
      element: el,
    })
      .setLngLat(initialPos as [number, number])
      .addTo(map);

    uiLogger.info('📍 User location marker created');

    return () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
    };
  }, [map, mapReady]);

  // Update marker position when location changes
  useEffect(() => {
    if (!location || !userMarkerRef.current) return;

    userMarkerRef.current.setLngLat([
      location.coords.longitude,
      location.coords.latitude,
    ]);
    uiLogger.debug('📍 User marker position updated');
  }, [location]);

  return {
    userMarker: userMarkerRef.current,
  };
}