import { generateMarkerHTML } from '@/constants/marker-icons';
import { Marker } from '@/types/marker';
import { useCallback, useEffect } from 'react';

interface UseMapMarkersOptions {
  webViewRef: React.RefObject<any>;
  mapReady: boolean;
  markers?: Marker[];
  refreshing?: boolean;
}

export function useMapMarkers({ webViewRef, mapReady, markers, refreshing }: UseMapMarkersOptions) {
  // Add marker to map
  const addMarkerToMap = useCallback((marker: Marker) => {
    if (!webViewRef.current || !mapReady) return;

    const markerHTML = generateMarkerHTML(marker.type, marker.confidenceScore);
    const markerHTMLEscaped = JSON.stringify(markerHTML);

    const js = `
      (function() {
        if (!window.map) return;
        if (window.safePathMarkers['${marker.id}']) {
          window.map.removeLayer(window.safePathMarkers['${marker.id}']);
          delete window.safePathMarkers['${marker.id}'];
        }
        var markerHTML = ${markerHTMLEscaped};
        var icon = L.divIcon({
          className: 'custom-marker',
          html: markerHTML,
          iconSize: [40, 50],
          iconAnchor: [20, 50],
          popupAnchor: [0, -50]
        });
        var marker = L.marker([${marker.latitude}, ${marker.longitude}], {
          icon: icon,
          markerId: '${marker.id}'
        }).addTo(window.map);
        marker.on('click', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'markerClick',
            markerId: '${marker.id}'
          }));
        });
        window.safePathMarkers['${marker.id}'] = marker;
      })();
    `;
    webViewRef.current.injectJavaScript(js);
  }, [webViewRef, mapReady]);

  // Clear all markers
  const clearAllMarkers = useCallback(() => {
    if (!webViewRef.current || !mapReady) return;
    const js = `
      (function() {
        if (!window.map || !window.safePathMarkers) return;
        Object.values(window.safePathMarkers).forEach(function(marker) {
          window.map.removeLayer(marker);
        });
        window.safePathMarkers = {};
      })();
    `;
    webViewRef.current.injectJavaScript(js);
  }, [webViewRef, mapReady]);

  // Refresh all markers
  const refreshMapMarkers = useCallback((markers: Marker[]) => {
    clearAllMarkers();
    setTimeout(() => {
      markers.forEach(marker => addMarkerToMap(marker));
    }, 100);
  }, [addMarkerToMap, clearAllMarkers]);

  useEffect(() => {
    if (!mapReady || !webViewRef.current) return;
    if (!markers) return;
    if (refreshing) return;

    refreshMapMarkers(markers);
  }, [mapReady, markers ? markers.length : 0]);

  return {
    addMarkerToMap,
    clearAllMarkers,
    refreshMapMarkers,
  };
}