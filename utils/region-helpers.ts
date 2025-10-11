/**
 * Region and country detection utilities
 */

export interface Country {
  name: string;
  displayName: string;
}

/**
 * Get country name from coordinates using reverse geocoding
 * Uses Nominatim (OpenStreetMap) for free reverse geocoding
 */
export async function getCountryFromCoordinates(
  latitude: number,
  longitude: number
): Promise<string | null> {
  if (!latitude || !longitude) return null;

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=3&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'SafePath App'
        }
      }
    );
    
    const data = await response.json();
    return data.address?.country || null;
  } catch (error) {
    console.error('Error getting country:', error);
    return null;
  }
}

/**
 * Get display text for location badge
 */
export function getLocationDisplayText(
  country: string | null,
  isLocating: boolean
): string {
  if (isLocating) {
    return 'Locating...';
  }
  
  if (country) {
    return country;
  }
  
  return 'Unknown Location';
}
