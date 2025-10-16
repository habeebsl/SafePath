import { useEffect, useRef } from 'react';
import { generateMarkerHTML } from '@/constants/marker-icons';
import { uiLogger } from '@/utils/logger';
import { Marker } from '@/types/marker';

interface UseMapMarkersOptions {
  markers: Marker[];
  mapReady: boolean;
  mapRef: any;
  modals: any;
}

export function useMapMarkers({ markers, mapReady, mapRef, modals }: UseMapMarkersOptions) {
  const markerLayersRef = useRef<{ [key: string]: any }>({});

  // Add marker to Leaflet map with custom icon
  const addMarkerToMap = (marker: Marker) => {
    if (!mapReady || !mapRef.current) return;

    // Remove existing marker with same ID to prevent duplicates
    if (markerLayersRef.current[marker.id]) {
      mapRef.current.removeLayer(markerLayersRef.current[marker.id]);
      delete markerLayersRef.current[marker.id];
    }

    const markerHTML = generateMarkerHTML(marker.type, marker.confidenceScore);

    const icon = window.L.divIcon({
      className: 'custom-marker',
      html: markerHTML,
      iconSize: [40, 50],
      iconAnchor: [20, 50],
      popupAnchor: [0, -50]
    });

    const leafletMarker = window.L.marker([marker.latitude, marker.longitude], {
      icon: icon
    }).addTo(mapRef.current);

    leafletMarker.on('click', () => {
      modals.openMarkerDetails(marker);
    });

    markerLayersRef.current[marker.id] = leafletMarker;
  };

  // Clear all markers from map
  const clearAllMarkers = () => {
    if (!mapRef.current) return;
    Object.values(markerLayersRef.current).forEach((marker: any) => {
      mapRef.current.removeLayer(marker);
    });
    markerLayersRef.current = {};
  };

  // Refresh all markers on map
  const refreshMapMarkers = () => {
    uiLogger.info('Refreshing markers on map: ' + markers.length);
    clearAllMarkers();
    setTimeout(() => {
      markers.forEach(marker => addMarkerToMap(marker));
      uiLogger.info('Added markers on map: ' + markers.length);
    }, 100); // Small delay to ensure clear completes
  };

  // Refresh all markers on map when markers change
  useEffect(() => {
    if (!mapReady) return;
    refreshMapMarkers();
  }, [markers, mapReady]);

  return {
    markerLayersRef,
    addMarkerToMap,
    clearAllMarkers,
    refreshMapMarkers
  };
}