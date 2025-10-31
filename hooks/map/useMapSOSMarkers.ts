import { generateMarkerHTML } from '@/constants/marker-icons';
import { MarkerType } from '@/types/marker';
import { SOSMarker } from '@/types/sos';
import { useCallback, useEffect } from 'react';

interface UseMapSOSMarkersOptions {
  webViewRef: React.RefObject<any>;
  mapReady: boolean;
  sosMarkers?: SOSMarker[];
}

export function useMapSOSMarkers({ webViewRef, mapReady, sosMarkers }: UseMapSOSMarkersOptions) {
  // Add SOS marker to map
  const addSOSMarkerToMap = useCallback((sosMarker: SOSMarker) => {
    if (!webViewRef.current || !mapReady) return;

    const markerHTML = generateMarkerHTML('sos' as MarkerType, 100, sosMarker.status);
    const markerHTMLEscaped = JSON.stringify(markerHTML);

    const js = `
      (function() {
        if (!window.map) return;
        if (!window.sosMarkers) {
          window.sosMarkers = {};
        }
        
        // Remove existing SOS marker if it exists
        if (window.sosMarkers['${sosMarker.id}']) {
          window.sosMarkers['${sosMarker.id}'].remove();
          delete window.sosMarkers['${sosMarker.id}'];
        }
        
        // Create marker element
        var markerHTML = ${markerHTMLEscaped};
        var el = document.createElement('div');
        el.innerHTML = markerHTML;
        el.style.cursor = 'pointer';
        el.style.width = '48px';
        el.style.height = '58px';
        
        // Add click handler
        el.addEventListener('click', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'sosMarkerClick',
            sosMarkerId: '${sosMarker.id}'
          }));
        });
        
        // Create MapLibre marker
        var mapboxMarker = new maplibregl.Marker({
          element: el,
          anchor: 'bottom'
        })
        .setLngLat([${sosMarker.longitude}, ${sosMarker.latitude}])
        .addTo(window.map);
        
        window.sosMarkers['${sosMarker.id}'] = mapboxMarker;
      })();
    `;
    webViewRef.current.injectJavaScript(js);
  }, [webViewRef, mapReady]);

  // Clear all SOS markers from map
  const clearSOSMarkers = useCallback(() => {
    if (!webViewRef.current || !mapReady) return;
    const js = `
      (function() {
        if (!window.map || !window.sosMarkers) return;
        Object.values(window.sosMarkers).forEach(function(marker) {
          marker.remove();
        });
        window.sosMarkers = {};
      })();
    `;
    webViewRef.current.injectJavaScript(js);
  }, [webViewRef, mapReady]);

  // Auto-refresh SOS markers when sosMarkers array changes
  useEffect(() => {
    if (!mapReady || !webViewRef.current || !sosMarkers) return;
    clearSOSMarkers();
    sosMarkers.forEach(addSOSMarkerToMap);
  }, [mapReady, sosMarkers ? sosMarkers.length : 0]);

  return {
    addSOSMarkerToMap,
    clearSOSMarkers,
  };
}
