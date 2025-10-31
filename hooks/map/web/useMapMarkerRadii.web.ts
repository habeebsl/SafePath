import { Marker } from '@/types/marker';
import { uiLogger } from '@/utils/logger';
import maplibregl from 'maplibre-gl';
import { useEffect } from 'react';

interface UseMapMarkerRadiiOptions {
  map: maplibregl.Map | null;
  mapReady: boolean;
  markers: Marker[];
}

/**
 * Hook to display radius circles for markers that have a radius value
 */
export function useMapMarkerRadii({ map, mapReady, markers }: UseMapMarkerRadiiOptions) {
  // Effect to initialize layers once
  useEffect(() => {
    if (!mapReady || !map) return;

    const sourceId = 'marker-radii-source';
    const layerId = 'marker-radii-layer';

    // Only initialize if not already initialized
    if (map.getSource(sourceId)) return;

    // Create empty source
    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    });

    // Add fill layer (semi-transparent)
    map.addLayer({
      id: layerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': [
          'match',
          ['get', 'markerType'],
          'danger', '#FF4444',
          'safe', '#4CAF50',
          'warning', '#FF9800',
          'info', '#2196F3',
          '#888888', // default
        ],
        'fill-opacity': 0.15,
      },
    });

    // Add outline layer
    map.addLayer({
      id: `${layerId}-outline`,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': [
          'match',
          ['get', 'markerType'],
          'danger', '#FF4444',
          'safe', '#4CAF50',
          'warning', '#FF9800',
          'info', '#2196F3',
          '#888888', // default
        ],
        'line-width': 2,
        'line-opacity': 0.5,
      },
    });

    uiLogger.info('🔵 Initialized marker radius layers');

    // Cleanup on unmount only
    return () => {
      if (map.getLayer(`${layerId}-outline`)) {
        map.removeLayer(`${layerId}-outline`);
      }
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    };
  }, [map, mapReady]);

  // Effect to update data when markers change
  useEffect(() => {
    if (!mapReady || !map) return;

    const sourceId = 'marker-radii-source';
    const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
    
    if (!source) return;

    // Filter markers that have a radius
    const markersWithRadius = markers.filter(m => m.radius && m.radius > 0);

    // Create GeoJSON features for all marker radius circles
    const features = markersWithRadius.map(marker => {
      const radiusInKm = marker.radius! / 1000;
      const center = [marker.longitude, marker.latitude];
      const points = 64;
      const coords = [];

      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * 2 * Math.PI;
        const dx = radiusInKm * Math.cos(angle);
        const dy = radiusInKm * Math.sin(angle);
        
        // Approximate conversion (works reasonably well for small distances)
        const lon = center[0] + (dx / (111.32 * Math.cos(center[1] * Math.PI / 180)));
        const lat = center[1] + (dy / 110.574);
        
        coords.push([lon, lat]);
      }

      return {
        type: 'Feature' as const,
        properties: {
          markerId: marker.id,
          markerType: marker.type,
          radius: marker.radius,
        },
        geometry: {
          type: 'Polygon' as const,
          coordinates: [coords],
        },
      };
    });

    const geojson: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    // Update source data without removing/recreating layers
    source.setData(geojson);
    
    uiLogger.info(`🔵 Updated ${markersWithRadius.length} marker radius circles`);
  }, [map, mapReady, markers]);
}
