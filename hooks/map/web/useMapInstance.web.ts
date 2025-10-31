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
      uiLogger.info('📍 Initial GPS location captured:', {
        lat: location.coords.latitude,
        lng: location.coords.longitude
      });
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

    // Map click for adding markers (right-click)
    mapRef.current.on('contextmenu', (e) => {
      const event = new CustomEvent('mapContextMenu', {
        detail: { lat: e.lngLat.lat, lng: e.lngLat.lng }
      });
      window.dispatchEvent(event);
    });

    // Long-press support for mobile web (touch and hold)
    let touchTimer: ReturnType<typeof setTimeout> | null = null;
    let touchStartPos: { x: number; y: number } | null = null;
    const LONG_PRESS_DURATION = 500; // 500ms
    const MOVE_THRESHOLD = 10; // 10px movement tolerance

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return; // Only single finger
      
      const touch = e.touches[0];
      touchStartPos = { x: touch.clientX, y: touch.clientY };
      
      touchTimer = setTimeout(() => {
        if (touchStartPos && mapRef.current) {
          // Get map coordinates at touch position
          const point = mapRef.current.unproject([touchStartPos.x, touchStartPos.y]);
          
          uiLogger.info('📍 Long-press detected on mobile web');
          const event = new CustomEvent('mapContextMenu', {
            detail: { lat: point.lat, lng: point.lng }
          });
          window.dispatchEvent(event);
          
          // Vibrate if available (haptic feedback)
          if (navigator.vibrate) {
            navigator.vibrate(50);
          }
        }
      }, LONG_PRESS_DURATION);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartPos || !touchTimer) return;
      
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchStartPos.x);
      const dy = Math.abs(touch.clientY - touchStartPos.y);
      
      // If finger moved too much, cancel long-press
      if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
        if (touchTimer) {
          clearTimeout(touchTimer);
          touchTimer = null;
        }
        touchStartPos = null;
      }
    };

    const handleTouchEnd = () => {
      if (touchTimer) {
        clearTimeout(touchTimer);
        touchTimer = null;
      }
      touchStartPos = null;
    };

    // Add touch event listeners to the map canvas
    const canvas = mapRef.current.getCanvas();
    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: true });
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      uiLogger.info('Cleaning up MapLibre instance');
      
      // Clean up touch event listeners
      if (mapRef.current) {
        const canvas = mapRef.current.getCanvas();
        canvas.removeEventListener('touchstart', handleTouchStart as any);
        canvas.removeEventListener('touchmove', handleTouchMove as any);
        canvas.removeEventListener('touchend', handleTouchEnd);
        canvas.removeEventListener('touchcancel', handleTouchEnd);
      }
      
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [isClient, mapContainer, mapTilerKey]); // Added isClient to trigger init when DOM is ready

  // Recenter on initial GPS fix (only once)
  useEffect(() => {
    uiLogger.info('🔍 Recenter effect - mapReady:', mapReady, 'hasRecentered:', hasRecentered.current, 'location:', !!location, 'initialLocation:', !!initialLocation.current);
    
    if (!mapReady || !mapRef.current) {
      uiLogger.info('⏳ Map not ready yet');
      return;
    }
    
    if (hasRecentered.current) {
      uiLogger.info('✅ Already recentered, skipping');
      return;
    }
    
    // Use either the captured initial location OR the current location prop
    const locationToUse = initialLocation.current || location;
    if (!locationToUse) {
      uiLogger.info('⏳ Waiting for GPS location to recenter...');
      return;
    }

    const { latitude, longitude } = locationToUse.coords;
    uiLogger.info('📍 Auto-centering map on GPS location:', { latitude, longitude });
    
    mapRef.current.flyTo({
      center: [longitude, latitude],
      zoom: 17,
      duration: 1000,
    });
    
    hasRecentered.current = true;
    uiLogger.info('✅ Recenter complete');
  }, [mapReady, location]);

  return {
    map: mapRef.current,
    mapReady,
  };
}