import { Marker } from '@/types/marker';
import Mapbox from '@rnmapbox/maps';
import { useMemo } from 'react';

interface UseMapMarkersOptions {
  mapRef: React.RefObject<Mapbox.MapView | null>;
  mapReady: boolean;
  markers?: Marker[];
  refreshing?: boolean;
}

export function useMapMarkers({ mapRef, mapReady, markers, refreshing }: UseMapMarkersOptions) {
  // Convert markers to GeoJSON FeatureCollection
  const markersGeoJSON = useMemo(() => {
    if (!markers || markers.length === 0) {
      return {
        type: 'FeatureCollection' as const,
        features: [],
      };
    }

    return {
      type: 'FeatureCollection' as const,
      features: markers.map((marker) => ({
        type: 'Feature' as const,
        id: marker.id,
        geometry: {
          type: 'Point' as const,
          coordinates: [marker.longitude, marker.latitude],
        },
        properties: {
          id: marker.id,
          type: marker.type,
          confidenceScore: marker.confidenceScore,
          description: marker.description || '',
        },
      })),
    };
  }, [markers]);

  // Helper to refresh markers (for compatibility with existing code)
  const refreshMapMarkers = () => {
    // Native MapLibre automatically updates when GeoJSON changes
    // This is a no-op for compatibility
  };

  return {
    markersGeoJSON,
    refreshMapMarkers,
  };
}