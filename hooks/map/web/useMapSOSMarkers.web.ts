import { useEffect, useRef } from 'react';
import { generateMarkerHTML } from '@/constants/marker-icons';
import { uiLogger } from '@/utils/logger';
import { SOSMarker } from '@/types/sos';

interface UseMapSOSMarkersOptions {
  activeSOSMarkers: SOSMarker[];
  mapReady: boolean;
  mapRef: any;
  modals: any;
}

export function useMapSOSMarkers({ activeSOSMarkers, mapReady, mapRef, modals }: UseMapSOSMarkersOptions) {
  const sosMarkerLayersRef = useRef<{ [key: string]: any }>({});

  // Add SOS marker to Leaflet map with custom icon
  const addSOSMarkerToMap = (sosMarker: SOSMarker) => {
    if (!mapReady || !mapRef.current) return;

    // Remove existing SOS marker with same ID to prevent duplicates
    if (sosMarkerLayersRef.current[sosMarker.id]) {
      mapRef.current.removeLayer(sosMarkerLayersRef.current[sosMarker.id]);
      delete sosMarkerLayersRef.current[sosMarker.id];
    }

    const markerHTML = generateMarkerHTML('sos', 100, sosMarker.status);

    const icon = window.L.divIcon({
      className: 'custom-marker sos-marker',
      html: markerHTML,
      iconSize: [48, 58],
      iconAnchor: [24, 58],
      popupAnchor: [0, -58]
    });

    const leafletMarker = window.L.marker([sosMarker.latitude, sosMarker.longitude], {
      icon: icon
    }).addTo(mapRef.current);

    leafletMarker.on('click', () => {
      modals.openSOSDetails(sosMarker);
    });

    sosMarkerLayersRef.current[sosMarker.id] = leafletMarker;
  };

  // Clear all SOS markers from map
  const clearSOSMarkers = () => {
    if (!mapRef.current) return;
    Object.values(sosMarkerLayersRef.current).forEach((marker: any) => {
      mapRef.current.removeLayer(marker);
    });
    sosMarkerLayersRef.current = {};
  };

  // Refresh all SOS markers on map when they change
  useEffect(() => {
    if (!mapReady) return;
    
    uiLogger.info('🗺️ Updating SOS markers on map:', activeSOSMarkers.length);
    clearSOSMarkers();
    
    activeSOSMarkers.forEach(sosMarker => {
      uiLogger.info('➕ Adding SOS marker to map:', sosMarker.id);
      addSOSMarkerToMap(sosMarker);
    });
  }, [activeSOSMarkers, mapReady]);

  return {
    sosMarkerLayersRef,
    addSOSMarkerToMap,
    clearSOSMarkers,
  };
}