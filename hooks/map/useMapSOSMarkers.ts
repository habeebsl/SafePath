import { SOSMarker } from '@/types/sos';
import Mapbox from '@rnmapbox/maps';
import { useMemo } from 'react';

interface UseMapSOSMarkersOptions {
  mapRef: React.RefObject<Mapbox.MapView | null>;
  mapReady: boolean;
  sosMarkers: SOSMarker[];
}

export function useMapSOSMarkers({ mapRef, mapReady, sosMarkers }: UseMapSOSMarkersOptions) {
  // Convert SOS markers to GeoJSON FeatureCollection
  const sosMarkersGeoJSON = useMemo(() => {
    if (!sosMarkers || sosMarkers.length === 0) {
      return {
        type: 'FeatureCollection' as const,
        features: [],
      };
    }

    return {
      type: 'FeatureCollection' as const,
      features: sosMarkers.map((sosMarker) => ({
        type: 'Feature' as const,
        id: sosMarker.id,
        geometry: {
          type: 'Point' as const,
          coordinates: [sosMarker.longitude, sosMarker.latitude],
        },
        properties: {
          id: sosMarker.id,
          status: sosMarker.status,
          createdBy: sosMarker.createdBy,
          createdAt: sosMarker.createdAt,
        },
      })),
    };
  }, [sosMarkers]);

  return {
    sosMarkersGeoJSON,
  };
}
