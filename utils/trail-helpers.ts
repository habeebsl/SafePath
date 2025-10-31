/**
 * Utility functions for trail calculations
 */

interface Waypoint {
  lat: number;
  lon: number;
}

interface CurrentPosition {
  lat: number;
  lon: number;
}

/**
 * Find the closest waypoint to the current position
 */
export function findClosestWaypointIndex(
  waypoints: Waypoint[],
  currentPos: CurrentPosition
): number {
  let closestIndex = 0;
  let minDistance = Infinity;
  
  waypoints.forEach((point, index) => {
    const dx = point.lat - currentPos.lat;
    const dy = point.lon - currentPos.lon;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < minDistance) {
      minDistance = distance;
      closestIndex = index;
    }
  });
  
  return closestIndex;
}

/**
 * Get remaining waypoints from current position to destination
 */
export function getRemainingWaypoints(
  waypoints: Waypoint[],
  currentPos: CurrentPosition
): Waypoint[] {
  const closestIndex = findClosestWaypointIndex(waypoints, currentPos);
  
  // Create remaining waypoints: current position + waypoints ahead
  return [
    currentPos,
    ...waypoints.slice(closestIndex + 1)
  ];
}

/**
 * Calculate bearing (direction) from one point to another
 * Returns angle in degrees (0-360, where 0 is North)
 */
export function calculateBearing(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number
): number {
  const lat1 = fromLat * Math.PI / 180;
  const lat2 = toLat * Math.PI / 180;
  const dLon = (toLon - fromLon) * Math.PI / 180;
  
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  
  return bearing;
}
