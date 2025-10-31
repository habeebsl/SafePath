import { Trail } from '@/types/trail';
import { uiLogger } from '@/utils/logger';
import maplibregl from 'maplibre-gl';
import { useEffect, useRef, useState } from 'react';

interface UseMapTrailOptions {
  map: maplibregl.Map | null;
  mapReady: boolean;
  activeTrail: Trail | null;
}

export function useMapTrail({ map, mapReady, activeTrail }: UseMapTrailOptions) {
  const currentTrailIdRef = useRef<string | null>(null);
  const [styleLoaded, setStyleLoaded] = useState(false);

  // Wait for style to be loaded
  useEffect(() => {
    if (!map || !mapReady) return;
    
    if (map.isStyleLoaded()) {
      setStyleLoaded(true);
      uiLogger.debug('✅ Map style already loaded');
    } else {
      uiLogger.debug('⏳ Waiting for map style to load...');
      const onStyleLoad = () => {
        setStyleLoaded(true);
        uiLogger.info('✅ Map style loaded');
        map.off('styledata', onStyleLoad);
      };
      map.on('styledata', onStyleLoad);
      
      return () => {
        map.off('styledata', onStyleLoad);
      };
    }
  }, [map, mapReady]);

  useEffect(() => {
    if (!mapReady || !map || !styleLoaded) {
      uiLogger.debug('Trail hook waiting: mapReady=' + mapReady + ', map=' + !!map + ', styleLoaded=' + styleLoaded);
      return;
    }

    const newTrailId = activeTrail ? `${activeTrail.targetMarker.id}-${activeTrail.context}` : null;

    // Only update if trail actually changed (not just progress update)
    if (currentTrailIdRef.current === newTrailId) {
      uiLogger.debug('Trail ID unchanged, skipping render');
      return;
    }

    currentTrailIdRef.current = newTrailId;

    // Remove existing trail source and layer
    if (map.getLayer('trail-line')) {
      map.removeLayer('trail-line');
      uiLogger.debug('Removed existing trail layer');
    }
    if (map.getSource('trail')) {
      map.removeSource('trail');
      uiLogger.debug('Removed existing trail source');
    }

    if (!activeTrail) {
      uiLogger.info('🗺️ Trail cleared from map');
      return;
    }

    // Draw trail
    uiLogger.info('🗺️ Drawing trail:', activeTrail.targetMarker.id);
    const waypoints = activeTrail.route.waypoints;
    const isOffline = activeTrail.route.strategy === 'offline';
    const coordinates = waypoints.map(wp => [wp.lon, wp.lat]);
    
    uiLogger.info('Trail coordinates:', coordinates.length, 'points');

    try {
      // Add trail source
      map.addSource('trail', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates,
          },
        },
      });
      uiLogger.info('✅ Trail source added');

      // Add trail layer with very visible styling
      const layerConfig: any = {
        id: 'trail-line',
        type: 'line',
        source: 'trail',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': activeTrail.color || '#FF0000', // Fallback to red
          'line-width': 6, // Thicker line
          'line-opacity': isOffline ? 0.7 : 0.9,
        },
      };
      
      // Add dash array for offline trails
      if (isOffline) {
        layerConfig.paint['line-dasharray'] = [2, 2];
      }
      
      map.addLayer(layerConfig);
      uiLogger.info('✅ Trail layer added with color:', activeTrail.color, 'isOffline:', isOffline);

      // Auto-zoom to show entire trail
      const bounds = new maplibregl.LngLatBounds();
      coordinates.forEach(coord => {
        bounds.extend(coord as [number, number]);
      });

      map.fitBounds(bounds, {
        padding: 50,
        maxZoom: 16,
      });

      uiLogger.info('🗺️ Trail rendered on map successfully');
    } catch (error) {
      uiLogger.error('❌ Error rendering trail:', error);
    }
  }, [activeTrail, mapReady, map, styleLoaded]);
}