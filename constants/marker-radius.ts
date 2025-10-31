/**
 * Marker Radius Configuration
 * Defines default radius values and constraints for marker affected areas
 */

import { MarkerType } from '@/types/marker';

// Radius constraints (in meters)
export const MIN_RADIUS = 10;
export const MAX_RADIUS = 2000;
export const DEFAULT_STEP = 10;

// Default radius values for each marker type (in meters)
export const DEFAULT_MARKER_RADIUS: Record<MarkerType, number> = {
  safe: 150,      // Larger safe zones give people more confidence
  danger: 100,    // Standard danger area (small building, intersection)
  combat: 300,    // Active combat zones are much larger (stray bullets, shrapnel)
  uncertain: 0,   // Optional - user decides
  medical: 0,     // Point-specific (hospital entrance)
  food: 0,        // Point-specific (resource cache)
  shelter: 0,     // Point-specific (shelter entrance)
  checkpoint: 0,  // Point-specific (exact location matters)
  sos: 0,         // Point-specific emergency
};

// Marker types that always have a default radius
export const MARKER_TYPES_WITH_MANDATORY_RADIUS: MarkerType[] = ['safe', 'danger', 'combat'];

/**
 * Get default radius for a marker type
 */
export function getDefaultRadius(type: MarkerType): number {
  return DEFAULT_MARKER_RADIUS[type];
}

/**
 * Check if a marker type has a mandatory default radius
 */
export function hasMandatoryRadius(type: MarkerType): boolean {
  return MARKER_TYPES_WITH_MANDATORY_RADIUS.includes(type);
}

/**
 * Validate radius value
 */
export function validateRadius(radius: number | null | undefined): boolean {
  if (radius === null || radius === undefined) return true; // Optional is valid
  return radius >= MIN_RADIUS && radius <= MAX_RADIUS;
}

/**
 * Format radius for display
 */
export function formatRadius(radius: number): string {
  if (radius >= 1000) {
    return `${(radius / 1000).toFixed(1)} km`;
  }
  return `${radius} m`;
}

/**
 * Round radius to nearest step
 */
export function roundRadius(radius: number): number {
  return Math.round(radius / DEFAULT_STEP) * DEFAULT_STEP;
}

/**
 * Get radius circle style configuration
 */
export function getRadiusCircleStyle(color: string) {
  return {
    fillColor: color,
    fillOpacity: 0.15,
    strokeColor: color,
    strokeOpacity: 0.4,
    strokeWidth: 2,
  };
}
