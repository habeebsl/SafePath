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
        if (window.sosMarkers['${sosMarker.id}']) {
          window.map.removeLayer(window.sosMarkers['${sosMarker.id}']);
          delete window.sosMarkers['${sosMarker.id}'];
        }
        var markerHTML = ${markerHTMLEscaped};
        var icon = L.divIcon({
          className: 'custom-marker sos-marker',
          html: markerHTML,
          iconSize: [48, 58],
          iconAnchor: [24, 58],
          popupAnchor: [0, -58]
        });
        var marker = L.marker([${sosMarker.latitude}, ${sosMarker.longitude}], {
          icon: icon,
          markerId: '${sosMarker.id}',
          markerType: 'sos'
        }).addTo(window.map);
        marker.on('click', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'sosMarkerClick',
            sosMarkerId: '${sosMarker.id}'
          }));
        });
        window.sosMarkers['${sosMarker.id}'] = marker;
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
          window.map.removeLayer(marker);
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
