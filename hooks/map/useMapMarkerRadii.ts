import { MARKER_CONFIG } from '@/constants/marker-icons';
import { Marker } from '@/types/marker';
import { uiLogger } from '@/utils/logger';
import { useEffect } from 'react';

interface UseMapMarkerRadiiOptions {
  webViewRef: React.RefObject<any>;
  mapReady: boolean;
  markers: Marker[];
}

/**
 * Hook to display radius circles for markers that have a radius value
 */
export function useMapMarkerRadii({ webViewRef, mapReady, markers }: UseMapMarkerRadiiOptions) {
  useEffect(() => {
    if (!webViewRef.current || !mapReady) return;

    // Filter markers that have a radius
    const markersWithRadius = markers.filter(m => m.radius && m.radius > 0);

    if (markersWithRadius.length === 0) {
      // Remove layer and source if no markers have radius
      const js = `
        (function() {
          if (!window.map) return;
          var layerId = 'marker-radii-layer';
          var outlineLayerId = 'marker-radii-layer-outline';
          var sourceId = 'marker-radii-source';
          
          if (window.map.getLayer(outlineLayerId)) {
            window.map.removeLayer(outlineLayerId);
          }
          if (window.map.getLayer(layerId)) {
            window.map.removeLayer(layerId);
          }
          if (window.map.getSource(sourceId)) {
            window.map.removeSource(sourceId);
          }
        })();
      `;
      webViewRef.current.injectJavaScript(js);
      return;
    }

    // Create GeoJSON features for all marker radius circles
    const features = markersWithRadius.map(marker => {
      const radiusInKm = marker.radius! / 1000;
      const center = [marker.longitude, marker.latitude];
      const points = 64;
      const coords: number[][] = [];

      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * 2 * Math.PI;
        const dx = radiusInKm * Math.cos(angle);
        const dy = radiusInKm * Math.sin(angle);
        
        // Approximate conversion (works reasonably well for small distances)
        const lon = center[0] + (dx / (111.32 * Math.cos(center[1] * Math.PI / 180)));
        const lat = center[1] + (dy / 110.574);
        
        coords.push([lon, lat]);
      }

      const config = MARKER_CONFIG[marker.type];
      
      return {
        type: 'Feature',
        properties: {
          markerId: marker.id,
          markerType: marker.type,
          color: config.color,
          radius: marker.radius,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [coords],
        },
      };
    });

    const geojson = {
      type: 'FeatureCollection',
      features,
    };

    // Inject JavaScript to add/update the radius circles
    const js = `
      (function() {
        if (!window.map) return;
        
        var sourceId = 'marker-radii-source';
        var layerId = 'marker-radii-layer';
        var outlineLayerId = 'marker-radii-layer-outline';
        
        var geojson = ${JSON.stringify(geojson)};
        
        var source = window.map.getSource(sourceId);
        if (source) {
          source.setData(geojson);
        } else {
          window.map.addSource(sourceId, {
            type: 'geojson',
            data: geojson
          });
          
          // Add fill layer (semi-transparent)
          window.map.addLayer({
            id: layerId,
            type: 'fill',
            source: sourceId,
            paint: {
              'fill-color': ['get', 'color'],
              'fill-opacity': 0.15
            }
          });
          
          // Add outline layer
          window.map.addLayer({
            id: outlineLayerId,
            type: 'line',
            source: sourceId,
            paint: {
              'line-color': ['get', 'color'],
              'line-width': 2,
              'line-opacity': 0.5
            }
          });
        }
      })();
    `;

    webViewRef.current.injectJavaScript(js);
    uiLogger.info(`🔵 Displaying ${markersWithRadius.length} marker radius circles`);

  }, [webViewRef, mapReady, markers]);
}
