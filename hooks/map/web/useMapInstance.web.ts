import { useEffect, useRef, useState } from 'react';
import { uiLogger } from '@/utils/logger';

interface UseMapInstanceOptions {
  location: any; // From LocationContext
  initialCenter: [number, number];
  initialZoom: number;
}

export function useMapInstance({ location, initialCenter, initialZoom }: UseMapInstanceOptions) {
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [initialLocationSet, setInitialLocationSet] = useState(false);
  const initialLocation = useRef<typeof location>(null);

  // Detect client-side rendering
  useEffect(() => {
    uiLogger.info('🌍 Checking if client-side...', typeof window !== 'undefined');
    setIsClient(typeof window !== 'undefined');
  }, []);

  // Capture the first location we get from GPS
  useEffect(() => {
    if (location && !initialLocation.current) {
      initialLocation.current = location;
      setInitialLocationSet(true);
    }
  }, [location]);

  // Center map on user location when we first get GPS fix
  useEffect(() => {
    if (initialLocationSet && mapReady && mapRef.current && location) {
      uiLogger.info('📍 Auto-centering map on first GPS fix');
      mapRef.current.setView(
        [location.coords.latitude, location.coords.longitude],
        17,
        { animate: true }
      );
    }
  }, [initialLocationSet, mapReady]);

  // MapContainer ref callback
  const handleMapRef = (map: any) => {
    if (map && !mapReady) {
      mapRef.current = map;
      setMapReady(true);
      uiLogger.info('🗺️ Map instance created');
    }
  };

  return {
    mapRef,
    mapReady,
    isClient,
    initialCenter,
    initialZoom,
    handleMapRef,
  };
}