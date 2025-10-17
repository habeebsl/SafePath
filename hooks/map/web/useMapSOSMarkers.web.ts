import { generateMarkerHTML } from '@/constants/marker-icons';
import { SOSMarker } from '@/types/sos';
import { uiLogger } from '@/utils/logger';
import maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';

interface UseMapSOSMarkersOptions {
  map: maplibregl.Map | null;
  mapReady: boolean;
  sosMarkers: SOSMarker[];
  modals: any;
}

export function useMapSOSMarkers({ map, mapReady, sosMarkers, modals }: UseMapSOSMarkersOptions) {
  const sosMarkerInstancesRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const lastSOSMarkersRef = useRef<string>(''); // Track SOS markers by IDs

  // Add SOS marker to MapLibre map with custom icon
  const addSOSMarkerToMap = (sosMarker: SOSMarker) => {
    if (!mapReady || !map) return;

    // Remove existing SOS marker with same ID to prevent duplicates
    const existing = sosMarkerInstancesRef.current.get(sosMarker.id);
    if (existing) {
      existing.remove();
      sosMarkerInstancesRef.current.delete(sosMarker.id);
    }

    const markerHTML = generateMarkerHTML('sos', 100, sosMarker.status);

    // Create HTML element for marker
    const el = document.createElement('div');
    el.className = 'custom-marker sos-marker';
    el.innerHTML = markerHTML;
    el.style.cursor = 'pointer';

    // Create MapLibre marker
    const mlMarker = new maplibregl.Marker({
      element: el,
      anchor: 'bottom',
    })
      .setLngLat([sosMarker.longitude, sosMarker.latitude])
      .addTo(map);

    // Add click handler
    el.addEventListener('click', () => {
      modals.openSOSDetails(sosMarker);
    });

    sosMarkerInstancesRef.current.set(sosMarker.id, mlMarker);
  };

  // Clear all SOS markers from map
  const clearSOSMarkers = () => {
    sosMarkerInstancesRef.current.forEach(marker => marker.remove());
    sosMarkerInstancesRef.current.clear();
  };

  // Refresh all SOS markers on map when they actually change
  useEffect(() => {
    if (!mapReady || !map) return;
    
    // Create a stable key to detect actual changes
    const sosMarkersKey = sosMarkers.map(m => m.id).sort().join(',');
    
    // Only refresh if SOS markers actually changed
    if (sosMarkersKey === lastSOSMarkersRef.current) {
      return;
    }
    
    lastSOSMarkersRef.current = sosMarkersKey;
    uiLogger.info('🗺️ SOS markers changed, refreshing map:', sosMarkers.length);
    clearSOSMarkers();
    
    sosMarkers.forEach(sosMarker => {
      addSOSMarkerToMap(sosMarker);
    });
  }, [sosMarkers, mapReady, map]);

  return {
    addSOSMarkerToMap,
    clearSOSMarkers,
  };
}