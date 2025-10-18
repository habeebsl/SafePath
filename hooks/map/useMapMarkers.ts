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
        
        // Remove existing marker if it exists
        if (window.safePathMarkers['${marker.id}']) {
          window.safePathMarkers['${marker.id}'].remove();
          delete window.safePathMarkers['${marker.id}'];
        }
        
        // Create marker element
        var markerHTML = ${markerHTMLEscaped};
        var el = document.createElement('div');
        el.innerHTML = markerHTML;
        el.style.cursor = 'pointer';
        el.style.width = '40px';
        el.style.height = '50px';
        
        // Add click handler
        el.addEventListener('click', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'markerClick',
            markerId: '${marker.id}'
          }));
        });
        
        // Create MapLibre marker
        var mapboxMarker = new maplibregl.Marker({
          element: el,
          anchor: 'bottom'
        })
        .setLngLat([${marker.longitude}, ${marker.latitude}])
        .addTo(window.map);
        
        window.safePathMarkers['${marker.id}'] = mapboxMarker;
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
          marker.remove();
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