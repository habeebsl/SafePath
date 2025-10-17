import Mapbox from '@rnmapbox/maps';
import * as Location from 'expo-location';

interface UseMapUserLocationOptions {
  mapRef: React.RefObject<Mapbox.MapView | null>;
  mapReady: boolean;
  location?: Location.LocationObject | null;
}

// For native MapLibre, user location is handled by the UserLocation component
// This hook is kept for consistency but doesn't need to do anything
export function useMapUserLocation({
  mapRef,
  mapReady,
  location,
}: UseMapUserLocationOptions) {
  // UserLocation component in map.tsx handles location updates automatically
  // No manual updates needed for native MapLibre
}