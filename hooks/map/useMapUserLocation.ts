import { Trail } from '@/types/trail';
import { getRemainingWaypoints } from '@/utils/trail-helpers';
import * as Location from 'expo-location';
import { useEffect, useRef } from 'react';

interface UseMapUserLocationOptions {
  webViewRef: React.RefObject<any>;
  mapReady: boolean;
  location?: Location.LocationObject | null;
  activeTrail?: Trail | null;
}

export function useMapUserLocation({
  webViewRef,
  mapReady,
  location,
  activeTrail,
}: UseMapUserLocationOptions) {
  const lastUpdateTime = useRef<number>(0);
  const lastCoords = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!location || !mapReady || !webViewRef.current) return;

    const now = Date.now();
    const newLat = location.coords.latitude;
    const newLng = location.coords.longitude;

    // Check if we should update position (throttled to 2 seconds)
    const shouldUpdatePosition = (now - lastUpdateTime.current >= 2000);
    
    // Check if position changed significantly
    let positionChanged = true;
    if (lastCoords.current && shouldUpdatePosition) {
      const latDiff = Math.abs(newLat - lastCoords.current.lat);
      const lngDiff = Math.abs(newLng - lastCoords.current.lng);
      
      // Skip update if change is less than ~5 meters (~0.00005 degrees)
      positionChanged = (latDiff >= 0.00005 || lngDiff >= 0.00005);
    }

    // Calculate next waypoint for bearing if on trail
    let nextWaypoint = null;
    if (activeTrail) {
      const currentPos = { lat: newLat, lon: newLng };
      const remainingWaypoints = getRemainingWaypoints(activeTrail.route.waypoints, currentPos);
      // remainingWaypoints[0] is current position, [1] is the next waypoint on the trail
      if (remainingWaypoints.length > 1) {
        nextWaypoint = remainingWaypoints[1];
      }
    }

    // Update the marker position if enough time passed and position changed
    if (shouldUpdatePosition && positionChanged) {
      const js = `
        if (window.map && window.userMarker) {
          window.userMarker.setLngLat([${newLng}, ${newLat}]);
        }
      `;
      webViewRef.current.injectJavaScript(js);
      
      lastUpdateTime.current = now;
      lastCoords.current = { lat: newLat, lng: newLng };
    }

    // Always update bearing if navigating (even without position change)
    // This ensures rotation updates when trail changes or when entering navigation mode
    if (activeTrail && nextWaypoint) {
      const js = `
        if (window.updateNavigationBearing) {
          window.updateNavigationBearing(${newLat}, ${newLng}, ${nextWaypoint.lat}, ${nextWaypoint.lon});
        }
      `;
      webViewRef.current.injectJavaScript(js);
    }
  }, [location, mapReady, webViewRef, activeTrail]);
}