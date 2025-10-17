import Mapbox from '@rnmapbox/maps';
import { LocationObject } from 'expo-location';
import { useEffect, useRef, useState } from 'react';

interface UseMapInstanceOptions {
  mapRef: React.RefObject<Mapbox.MapView | null>;
  cameraRef: React.RefObject<Mapbox.Camera | null>;
  location?: LocationObject | null;
}

export function useMapInstance({ mapRef, cameraRef, location }: UseMapInstanceOptions) {
  const [mapReady, setMapReady] = useState(false);
  const [initialLocationSet, setInitialLocationSet] = useState(false);
  const initialLocation = useRef<LocationObject | null>(null);

  // Capture the first location we get from GPS
  useEffect(() => {
    if (location && !initialLocation.current) {
      initialLocation.current = location;
      setInitialLocationSet(true);
    }
  }, [location]);

  // Center map on user location when we first get GPS fix
  useEffect(() => {
    if (initialLocationSet && mapReady && cameraRef.current && location) {
      cameraRef.current.setCamera({
        centerCoordinate: [location.coords.longitude, location.coords.latitude],
        zoomLevel: 15,
        animationDuration: 1000,
      });
    }
  }, [initialLocationSet, mapReady, cameraRef, location]);

  return { 
    mapReady,
    setMapReady,
    initialLocation
  };
}