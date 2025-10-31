import { Trail } from '@/types/trail';
import { uiLogger } from '@/utils/logger';
import { calculateBearing, getRemainingWaypoints } from '@/utils/trail-helpers';
import maplibregl from 'maplibre-gl';
import { useEffect, useRef } from 'react';

interface UseMapUserLocationOptions {
  map: maplibregl.Map | null;
  mapReady: boolean;
  location: any; // From LocationContext
  activeTrail?: Trail | null;
}

export function useMapUserLocation({ map, mapReady, location, activeTrail }: UseMapUserLocationOptions) {
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userMarkerElementRef = useRef<HTMLDivElement | null>(null);
  const pulseElementRef = useRef<HTMLDivElement | null>(null);
  const isNavigatingRef = useRef(false);
  const lastUpdateTime = useRef<number>(0);
  const lastCoords = useRef<{ lat: number; lng: number } | null>(null);

  // Create user marker when map is ready (once)
  useEffect(() => {
    if (!mapReady || !map) return;

    // Create custom user marker element
    const el = document.createElement('div');
    el.className = 'user-marker';
    el.style.width = '20px';
    el.style.height = '20px';
    el.style.backgroundColor = '#007AFF';
    el.style.border = '3px solid white';
    el.style.borderRadius = '50%';
    el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
    el.style.position = 'relative';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';

    userMarkerElementRef.current = el;

    // Create marker (will be positioned when location is available)
    const initialPos = location 
      ? [location.coords.longitude, location.coords.latitude]
      : [0, 0];

    userMarkerRef.current = new maplibregl.Marker({
      element: el,
      rotationAlignment: 'map',
      pitchAlignment: 'map',
    })
      .setLngLat(initialPos as [number, number])
      .addTo(map);

    // Add pulse animation CSS if not already added
    if (!document.getElementById('navigation-pulse-styles')) {
      const style = document.createElement('style');
      style.id = 'navigation-pulse-styles';
      style.textContent = `
        @keyframes trailPulse {
          0% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.5);
            opacity: 0;
          }
          100% {
            transform: scale(1);
            opacity: 0.8;
          }
        }
        
        .navigation-pulse {
          position: absolute;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          animation: trailPulse 2s ease-out infinite;
          pointer-events: none;
        }
      `;
      document.head.appendChild(style);
    }

    uiLogger.info('📍 User location marker created');

    return () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      userMarkerElementRef.current = null;
      pulseElementRef.current = null;
    };
  }, [map, mapReady]);

  // Enable/disable navigation mode based on activeTrail
  useEffect(() => {
    if (!userMarkerElementRef.current || !userMarkerRef.current) return;

    const el = userMarkerElementRef.current;

    if (activeTrail && location) {
      // Enable navigation mode
      isNavigatingRef.current = true;
      const trailColor = activeTrail.color;

      // Update marker size and style
      el.style.width = '40px';
      el.style.height = '40px';
      el.style.backgroundColor = trailColor;
      el.style.border = '4px solid white';

      // Add navigation arrow
      el.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#ffffff" style="display: block;"><path d="m200-120-40-40 320-720 320 720-40 40-280-120-280 120Z"/></svg>';

      // Remove existing pulse if any
      if (pulseElementRef.current && pulseElementRef.current.parentNode) {
        pulseElementRef.current.parentNode.removeChild(pulseElementRef.current);
        pulseElementRef.current = null;
      }

      // Create new pulse effect
      const pulseElement = document.createElement('div');
      pulseElement.className = 'navigation-pulse';
      pulseElement.style.backgroundColor = trailColor;
      pulseElement.style.top = '-5px';
      pulseElement.style.left = '-5px';
      el.appendChild(pulseElement);
      pulseElementRef.current = pulseElement;

      // Calculate initial bearing immediately
      const currentPos = { lat: location.coords.latitude, lon: location.coords.longitude };
      const remainingWaypoints = getRemainingWaypoints(activeTrail.route.waypoints, currentPos);
      
      if (remainingWaypoints.length > 1) {
        const nextWaypoint = remainingWaypoints[1];
        const bearing = calculateBearing(
          location.coords.latitude,
          location.coords.longitude,
          nextWaypoint.lat,
          nextWaypoint.lon
        );
        userMarkerRef.current.setRotation(bearing);
        uiLogger.info('🧭 Initial bearing set:', bearing.toFixed(1), '°');
      }

      uiLogger.info('🧭 Navigation mode enabled with color:', trailColor);
    } else {
      // Disable navigation mode
      isNavigatingRef.current = false;

      // Reset marker size and style
      el.style.width = '20px';
      el.style.height = '20px';
      el.style.backgroundColor = '#007AFF';
      el.style.border = '3px solid white';
      el.innerHTML = '';

      // Remove pulse
      if (pulseElementRef.current && pulseElementRef.current.parentNode) {
        pulseElementRef.current.parentNode.removeChild(pulseElementRef.current);
        pulseElementRef.current = null;
      }

      // Reset rotation
      if (userMarkerRef.current) {
        userMarkerRef.current.setRotation(0);
      }

      uiLogger.info('🧭 Navigation mode disabled');
    }
  }, [activeTrail, location]);

  // Update marker position and rotation when location changes
  useEffect(() => {
    if (!location || !userMarkerRef.current) return;

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

    // Update marker position if enough time passed and position changed
    if (shouldUpdatePosition && positionChanged) {
      userMarkerRef.current.setLngLat([newLng, newLat]);
      lastUpdateTime.current = now;
      lastCoords.current = { lat: newLat, lng: newLng };
      uiLogger.debug('📍 User marker position updated');
    }

    // Always calculate and update bearing if navigating (even without position change)
    // This ensures rotation updates when trail changes or when entering navigation mode
    if (isNavigatingRef.current && activeTrail) {
      const currentPos = { lat: newLat, lon: newLng };
      const remainingWaypoints = getRemainingWaypoints(activeTrail.route.waypoints, currentPos);
      
      // remainingWaypoints[0] is current position, [1] is the next waypoint on the trail
      if (remainingWaypoints.length > 1) {
        const nextWaypoint = remainingWaypoints[1];
        
        // Calculate bearing using shared utility
        const bearing = calculateBearing(newLat, newLng, nextWaypoint.lat, nextWaypoint.lon);
        
        // Set marker rotation
        userMarkerRef.current.setRotation(bearing);
        uiLogger.info('🧭 Bearing updated:', bearing.toFixed(1), '° → next waypoint:', nextWaypoint);
      } else {
        uiLogger.warn('⚠️ No remaining waypoints to calculate bearing');
      }
    }
  }, [location, activeTrail]);

  return {
    userMarker: userMarkerRef.current,
  };
}