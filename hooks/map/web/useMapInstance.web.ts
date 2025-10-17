import { uiLogger } from '@/utils/logger';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { useEffect, useRef, useState } from 'react';

interface UseMapInstanceOptions {
  mapContainer: React.RefObject<HTMLDivElement | null>;
  location: any; // From LocationContext
  initialCenter: [number, number];
  initialZoom: number;
  mapTilerKey: string;
  isClient: boolean;
}

export function useMapInstance({ 
  mapContainer, 
  location, 
  initialCenter, 
  initialZoom,
  mapTilerKey,
  isClient
}: UseMapInstanceOptions) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const initialLocation = useRef<typeof location>(null);
  const hasRecentered = useRef(false);

  // Capture the first location we get from GPS
  useEffect(() => {
    if (location && !initialLocation.current) {
      initialLocation.current = location;
      uiLogger.info('📍 Initial GPS location captured');
    }
  }, [location]);

  // Initialize MapLibre map
  useEffect(() => {
    if (!isClient) {
      uiLogger.info('⏳ Waiting for client-side hydration...');
      return;
    }
    if (!mapContainer.current) {
      uiLogger.warn('⚠️ Map container ref is null');
      return;
    }
    if (mapRef.current) {
      uiLogger.info('✅ Map already initialized');
      return;
    }

    uiLogger.info('🗺️ Initializing MapLibre GL JS...');

    // Register PMTiles protocol
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);

    const lat = initialLocation.current?.coords.latitude || initialCenter[0];
    const lng = initialLocation.current?.coords.longitude || initialCenter[1];

    // Initialize map
    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'maptiler-raster': {
            type: 'raster',
            tiles: [
              mapTilerKey
                ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${mapTilerKey}`
                : 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png'
            ],
            tileSize: 256,
          },
        },
        layers: [
          {
            id: 'maptiler-layer',
            type: 'raster',
            source: 'maptiler-raster',
            minzoom: 0,
            maxzoom: 22,
          },
        ],
      },
      center: [lng, lat],
      zoom: initialZoom,
      // Smooth zoom and pan interactions
      touchZoomRotate: true,
      scrollZoom: true,
      dragPan: true,
      doubleClickZoom: true,
      touchPitch: false,
      // Make zoom smoother like Leaflet
      bearingSnap: 7,
      pitchWithRotate: false,
    });

    // Add zoom and navigation controls
    mapRef.current.addControl(new maplibregl.NavigationControl({
      showCompass: false,
    }), 'bottom-right');

    // Map ready event
    mapRef.current.on('load', () => {
      setMapReady(true);
      uiLogger.info('✅ MapLibre map loaded successfully');
      
      // Make scroll zoom VERY responsive like Leaflet
      // Default is 1/450 for wheel and 1/100 for zoom rate
      // Much lower denominator = much faster/more sensitive
      if (mapRef.current) {
        mapRef.current.scrollZoom.setWheelZoomRate(1 / 80); // Very fast wheel zoom (was 1/450)
        mapRef.current.scrollZoom.setZoomRate(1 / 30); // Very fast zoom animation (was 1/100)
      }
    });

    // Map click for adding markers (right-click/long-press)
    mapRef.current.on('contextmenu', (e) => {
      const event = new CustomEvent('mapContextMenu', {
        detail: { lat: e.lngLat.lat, lng: e.lngLat.lng }
      });
      window.dispatchEvent(event);
    });

    return () => {
      uiLogger.info('Cleaning up MapLibre instance');
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [isClient, mapContainer, mapTilerKey]); // Added isClient to trigger init when DOM is ready

  // Recenter on initial GPS fix (only once)
  useEffect(() => {
    if (!mapReady || !mapRef.current || hasRecentered.current) return;
    if (!initialLocation.current) return;

    const { latitude, longitude } = initialLocation.current.coords;
    uiLogger.info('📍 Auto-centering map on first GPS fix');
    
    mapRef.current.flyTo({
      center: [longitude, latitude],
      zoom: 17,
      duration: 1000,
    });
    
    hasRecentered.current = true;
  }, [mapReady]);

  return {
    map: mapRef.current,
    mapReady,
  };
}