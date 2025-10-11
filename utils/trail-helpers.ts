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
