/**
 * Region and country detection utilities
 */

import region from '@/config/region.json';
import { getDistance } from 'geolib';

export interface Country {
  name: string;
  displayName: string;
  priority: string;
  center: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Determine which country a coordinate belongs to
 * Uses distance from country centers - simple but effective for our use case
 */
export function getCountryFromCoordinates(
  latitude: number,
  longitude: number
): Country | null {
  if (!latitude || !longitude) return null;

  let closestCountry: Country | null = null;
  let closestDistance = Infinity;

  // Find the country with the closest center point
  for (const country of region.countries) {
    const distance = getDistance(
      { latitude, longitude },
      {
        latitude: country.center.latitude,
        longitude: country.center.longitude,
      }
    );

    if (distance < closestDistance) {
      closestDistance = distance;
      closestCountry = country as Country;
    }
  }

  // Only return if within reasonable distance (1000km)
  // This prevents assigning a country if user is far outside our region
  if (closestDistance < 1000000) {
    return closestCountry;
  }

  return null;
}

/**
 * Check if coordinates are within our supported region
 */
export function isInSupportedRegion(
  latitude: number,
  longitude: number
): boolean {
  const country = getCountryFromCoordinates(latitude, longitude);
  return country !== null;
}

/**
 * Get region display text for UI
 */
export function getRegionDisplayText(
  country: Country | null,
  isLocating: boolean
): string {
  if (isLocating) {
    return `${region.displayName} • Locating...`;
  }
  
  if (country) {
    return `${region.displayName} • ${country.displayName}`;
  }
  
  return region.displayName;
}
