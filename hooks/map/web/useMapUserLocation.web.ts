import { useEffect, useRef } from 'react';
import { uiLogger } from '@/utils/logger';

interface UseMapUserLocationOptions {
  location: any; // From LocationContext
  mapReady: boolean;
}

export function useMapUserLocation({ location, mapReady }: UseMapUserLocationOptions) {
  const userMarkerRef = useRef<any>(null);

  // Update user marker position when location changes (but don't recenter map)
  useEffect(() => {
    if (location && mapReady && userMarkerRef.current) {
      const newLatLng = [location.coords.latitude, location.coords.longitude];
      userMarkerRef.current.setLatLng(newLatLng);
      uiLogger.debug('📍 User marker position updated');
      // Don't call setView here - let user pan around freely
      // Only recenter when they click the recenter button
    }
  }, [location, mapReady]);

  return {
    userMarkerRef,
  };
}