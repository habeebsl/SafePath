import { generateMarkerHTML } from '@/constants/marker-icons';
import { Marker } from '@/types/marker';
import { uiLogger } from '@/utils/logger';
import maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';

interface UseMapMarkersOptions {
  map: maplibregl.Map | null;
  mapReady: boolean;
  markers: Marker[];
  modals: any;
}

export function useMapMarkers({ map, mapReady, markers, modals }: UseMapMarkersOptions) {
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const lastMarkersRef = useRef<string>(''); // Track markers by IDs to avoid re-render on array recreation

  // Add marker to map with custom icon
  const addMarkerToMap = (marker: Marker) => {
    if (!mapReady || !map) return;

    // Remove existing marker with same ID to prevent duplicates
    const existing = markersRef.current.get(marker.id);
    if (existing) {
      existing.remove();
      markersRef.current.delete(marker.id);
    }

    const markerHTML = generateMarkerHTML(marker.type, marker.confidenceScore);

    // Create HTML element
    const el = document.createElement('div');
    el.className = 'custom-marker';
    el.innerHTML = markerHTML;
    el.style.cursor = 'pointer';
    el.style.width = '40px';
    el.style.height = '50px';

    // Create MapLibre marker
    const mlMarker = new maplibregl.Marker({
      element: el,
      anchor: 'bottom',
    })
      .setLngLat([marker.longitude, marker.latitude])
      .addTo(map);

    // Add click handler
    el.addEventListener('click', () => {
      modals.openMarkerDetails(marker);
    });

    markersRef.current.set(marker.id, mlMarker);
  };

  // Clear all markers from map
  const clearAllMarkers = () => {
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();
  };

  // Refresh all markers on map
  const refreshMapMarkers = () => {
    uiLogger.info('🔄 Refreshing markers on map:', markers.length);
    clearAllMarkers();
    setTimeout(() => {
      markers.forEach(marker => addMarkerToMap(marker));
      uiLogger.info('✅ Added markers to map:', markers.length);
    }, 100);
  };

  // Refresh all markers when markers actually change (not just array recreation)
  useEffect(() => {
    if (!mapReady || !map) return;
    
    // Create a stable key based on marker IDs to detect actual changes
    const markersKey = markers.map(m => m.id).sort().join(',');
    
    // Only refresh if markers actually changed
    if (markersKey === lastMarkersRef.current) {
      return;
    }
    
    lastMarkersRef.current = markersKey;
    uiLogger.info('🗺️ Markers changed, refreshing map');
    refreshMapMarkers();
  }, [markers, mapReady, map]);

  return {
    addMarkerToMap,
    clearAllMarkers,
    refreshMapMarkers,
  };
}