/**
 * Routing System for SafePath
 * 
 * Hybrid approach:
 * 1. Try online routing (OpenRouteService) - best quality
 * 2. Fall back to cached routes - previously calculated online routes
 * 3. Fall back to simple offline routing - basic obstacle avoidance
 */

import { Coordinates, Marker } from '@/types/marker';
import polyline from '@mapbox/polyline';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { computeDestinationPoint, getDistance, getRhumbLineBearing } from 'geolib';

// ============================================================================
// TYPES
// ============================================================================

export enum RoutingStrategy {
  ONLINE = 'online',           // OpenRouteService
  CACHED = 'cached',           // Previously calculated online route
  OFFLINE_SIMPLE = 'offline'   // Simple straight line with obstacle avoidance
}

export interface Route {
  waypoints: Coordinates[];    // Array of lat/lon points to follow
  distance: number;            // Total distance in meters
  duration: number;            // Estimated duration in seconds
  strategy: RoutingStrategy;   // How was this route calculated
  calculatedAt: string;        // When was this calculated
  instructions?: string[];     // Optional turn-by-turn instructions
}

interface RouteCache {
  from: Coordinates;
  to: Coordinates;
  route: Route;
  timestamp: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const ORS_API_KEY = process.env.EXPO_PUBLIC_OPENROUTE_KEY || '';
const ORS_BASE_URL = 'https://api.openrouteservice.org/v2/directions/foot-walking/json';

// Cache settings
const CACHE_KEY_PREFIX = 'route_cache_';
const CACHE_EXPIRY_DAYS = 30;  // Routes valid for 30 days
const CACHE_DISTANCE_THRESHOLD = 50;  // Routes within 50m considered same

// Routing settings
const WALKING_SPEED_MS = 1.39;  // 5 km/h = 1.39 m/s
const DANGER_ZONE_BUFFER = 100; // Stay 100m away from danger zones

// ============================================================================
// MAIN ROUTING FUNCTION
// ============================================================================

export async function calculateRoute(
  from: Coordinates,
  to: Coordinates,
  context: {
    isOnline: boolean;
    dangerZones?: Marker[];
  }
): Promise<Route> {
  console.log('🗺️ Calculating route from', from, 'to', to);
  console.log('📡 Online:', context.isOnline);
  
  // Priority 1: Try online routing (best quality)
  if (context.isOnline && ORS_API_KEY) {
    try {
      console.log('🌐 Attempting online routing (OpenRouteService)...');
      const route = await calculateRouteOnline(from, to);
      console.log('✅ Online routing successful');
      
      // Cache this route for future offline use
      await cacheRoute(from, to, route);
      
      return route;
    } catch (error) {
      console.warn('⚠️ Online routing failed:', error);
    }
  } else if (!context.isOnline) {
    console.log('📵 Device is offline');
  } else if (!ORS_API_KEY) {
    console.warn('⚠️ No OpenRouteService API key configured');
  }
  
  // Priority 2: Check cache (previous online calculations)
  console.log('💾 Checking cached routes...');
  const cachedRoute = await getCachedRoute(from, to);
  if (cachedRoute) {
    console.log('✅ Using cached route from', cachedRoute.calculatedAt);
    return {
      ...cachedRoute,
      strategy: RoutingStrategy.CACHED
    };
  }
  
  // Priority 3: Simple offline routing (fallback)
  console.log('📍 Using simple offline routing');
  return calculateRouteOffline(from, to, context.dangerZones || []);
}

// ============================================================================
// ONLINE ROUTING (OpenRouteService)
// ============================================================================

async function calculateRouteOnline(
  from: Coordinates,
  to: Coordinates
): Promise<Route> {
  const url = `${ORS_BASE_URL}`;
  
  const body = {
    coordinates: [
      [from.lon, from.lat],  // Start: [longitude, latitude]
      [to.lon, to.lat]       // End: [longitude, latitude]
    ]
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/json, application/geo+json, application/gpx+xml, img/png; charset=utf-8',
      'Content-Type': 'application/json',
      'Authorization': ORS_API_KEY
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouteService error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  
  console.log('📦 OpenRouteService response:', JSON.stringify(data, null, 2));
  
  if (!data.routes || data.routes.length === 0) {
    throw new Error('No route found');
  }
  
  const route = data.routes[0];
  
  console.log('🛣️ Route geometry type:', typeof route.geometry);
  console.log('🛣️ Route geometry:', route.geometry);
  
  // Convert geometry to waypoints
  let waypoints: Coordinates[];
  
  if (typeof route.geometry === 'string') {
    // Encoded polyline format - decode it
    console.log('🔓 Decoding polyline...');
    const decoded = polyline.decode(route.geometry);
    // polyline.decode returns [[lat, lon], [lat, lon], ...]
    waypoints = decoded.map(([lat, lon]: [number, number]) => ({ lat, lon }));
    console.log(`✅ Decoded ${waypoints.length} waypoints from polyline`);
  } else if (route.geometry.coordinates && Array.isArray(route.geometry.coordinates)) {
    // GeoJSON format with coordinates array (lon, lat order)
    waypoints = route.geometry.coordinates.map(
      ([lon, lat]: [number, number]) => ({ lat, lon })
    );
  } else {
    throw new Error('Unknown geometry format in route response');
  }
  
  // OpenRouteService snaps points to nearest road, so the route might not start
  // exactly at user's position or end exactly at destination marker.
  // Add exact start/end points to ensure trail goes from user to destination
  const firstPoint = waypoints[0];
  const lastPoint = waypoints[waypoints.length - 1];
  
  // Check if first waypoint is different from actual start (user snapped to road)
  const startDistance = getDistance(
    { latitude: from.lat, longitude: from.lon },
    { latitude: firstPoint.lat, longitude: firstPoint.lon }
  );
  
  // Check if last waypoint is different from actual end (destination snapped to road)
  const endDistance = getDistance(
    { latitude: to.lat, longitude: to.lon },
    { latitude: lastPoint.lat, longitude: lastPoint.lon }
  );
  
  // If start point was snapped to road (>5m away), add actual user position first
  if (startDistance > 5) {
    console.log(`📍 Adding exact start point (${startDistance.toFixed(0)}m from road)`);
    waypoints.unshift({ lat: from.lat, lon: from.lon });
  }
  
  // If end point was snapped to road (>5m away), add actual destination last
  if (endDistance > 5) {
    console.log(`📍 Adding exact destination point (${endDistance.toFixed(0)}m from road)`);
    waypoints.push({ lat: to.lat, lon: to.lon });
  }
  
  console.log(`🗺️ Final route has ${waypoints.length} waypoints (start → road → destination)`);
  
  // Extract turn-by-turn instructions if available
  const instructions: string[] = [];
  if (route.segments && route.segments[0] && route.segments[0].steps) {
    route.segments[0].steps.forEach((step: any) => {
      if (step.instruction) {
        instructions.push(step.instruction);
      }
    });
  }
  
  return {
    waypoints,
    distance: route.summary.distance,
    duration: route.summary.duration,
    strategy: RoutingStrategy.ONLINE,
    calculatedAt: new Date().toISOString(),
    instructions: instructions.length > 0 ? instructions : undefined
  };
}

// ============================================================================
// OFFLINE ROUTING (Simple with obstacle avoidance)
// ============================================================================

function calculateRouteOffline(
  from: Coordinates,
  to: Coordinates,
  dangerZones: Marker[]
): Route {
  console.log('🧭 Calculating offline route...');
  console.log('🚫 Avoiding', dangerZones.length, 'danger zones');
  
  // Start with straight line
  let waypoints: Coordinates[] = [from, to];
  
  // Check if straight line crosses any danger zones
  for (const danger of dangerZones) {
    const dangerLocation = { lat: danger.latitude, lon: danger.longitude };
    
    if (lineIntersectsCircle(from, to, dangerLocation, DANGER_ZONE_BUFFER)) {
      console.log('⚠️ Route crosses danger zone:', danger.title);
      
      // Calculate avoidance waypoint
      const avoidancePoint = calculateAvoidancePoint(from, to, dangerLocation);
      
      // Insert avoidance point in route
      waypoints = [from, avoidancePoint, to];
      
      console.log('✓ Rerouting around danger zone');
      break;  // For now, only avoid first intersection
    }
  }
  
  // Calculate total distance
  const distance = calculateTotalDistance(waypoints);
  
  // Estimate duration based on walking speed
  const duration = Math.ceil(distance / WALKING_SPEED_MS);
  
  return {
    waypoints,
    distance,
    duration,
    strategy: RoutingStrategy.OFFLINE_SIMPLE,
    calculatedAt: new Date().toISOString()
  };
}

// ============================================================================
// CACHE MANAGEMENT
// ============================================================================

async function cacheRoute(
  from: Coordinates,
  to: Coordinates,
  route: Route
): Promise<void> {
  try {
    const cacheKey = generateCacheKey(from, to);
    const cacheData: RouteCache = {
      from,
      to,
      route,
      timestamp: new Date().toISOString()
    };
    
    await AsyncStorage.setItem(cacheKey, JSON.stringify(cacheData));
    console.log('💾 Route cached:', cacheKey);
  } catch (error) {
    console.error('Failed to cache route:', error);
    // Don't throw - caching failure shouldn't break routing
  }
}

async function getCachedRoute(
  from: Coordinates,
  to: Coordinates
): Promise<Route | null> {
  try {
    // Try exact cache key first
    const exactKey = generateCacheKey(from, to);
    const exactCache = await AsyncStorage.getItem(exactKey);
    
    if (exactCache) {
      const cacheData: RouteCache = JSON.parse(exactCache);
      
      // Check if cache is still valid
      if (isCacheValid(cacheData)) {
        console.log('✓ Found exact cached route');
        return cacheData.route;
      }
    }
    
    // Search for nearby cached routes (within 50m)
    const allKeys = await AsyncStorage.getAllKeys();
    const routeKeys = allKeys.filter(key => key.startsWith(CACHE_KEY_PREFIX));
    
    for (const key of routeKeys) {
      const cacheString = await AsyncStorage.getItem(key);
      if (!cacheString) continue;
      
      const cacheData: RouteCache = JSON.parse(cacheString);
      
      // Check if cached route is close enough to what we need
      const fromDistance = getDistance(from, cacheData.from);
      const toDistance = getDistance(to, cacheData.to);
      
      if (
        fromDistance < CACHE_DISTANCE_THRESHOLD &&
        toDistance < CACHE_DISTANCE_THRESHOLD &&
        isCacheValid(cacheData)
      ) {
        console.log('✓ Found nearby cached route');
        return cacheData.route;
      }
    }
    
    console.log('ℹ️ No cached route found');
    return null;
  } catch (error) {
    console.error('Failed to get cached route:', error);
    return null;
  }
}

function generateCacheKey(from: Coordinates, to: Coordinates): string {
  // Round coordinates to 4 decimal places (~11m precision)
  const fromKey = `${from.lat.toFixed(4)},${from.lon.toFixed(4)}`;
  const toKey = `${to.lat.toFixed(4)},${to.lon.toFixed(4)}`;
  return `${CACHE_KEY_PREFIX}${fromKey}_${toKey}`;
}

function isCacheValid(cacheData: RouteCache): boolean {
  const cacheAge = Date.now() - new Date(cacheData.timestamp).getTime();
  const maxAge = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  return cacheAge < maxAge;
}

export async function clearRouteCache(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const routeKeys = allKeys.filter(key => key.startsWith(CACHE_KEY_PREFIX));
    await AsyncStorage.multiRemove(routeKeys);
    console.log('🗑️ Route cache cleared');
  } catch (error) {
    console.error('Failed to clear route cache:', error);
  }
}

// ============================================================================
// GEOMETRY HELPERS
// ============================================================================

function lineIntersectsCircle(
  lineStart: Coordinates,
  lineEnd: Coordinates,
  circleCenter: Coordinates,
  circleRadius: number
): boolean {
  const distance = distanceFromPointToLineSegment(
    circleCenter,
    lineStart,
    lineEnd
  );
  
  return distance < circleRadius;
}

function distanceFromPointToLineSegment(
  point: Coordinates,
  lineStart: Coordinates,
  lineEnd: Coordinates
): number {
  // Convert to meters for calculation
  const x0 = point.lat;
  const y0 = point.lon;
  const x1 = lineStart.lat;
  const y1 = lineStart.lon;
  const x2 = lineEnd.lat;
  const y2 = lineEnd.lon;
  
  const dx = x2 - x1;
  const dy = y2 - y1;
  
  if (dx === 0 && dy === 0) {
    // Line is a point
    return getDistance(point, lineStart);
  }
  
  // Calculate parameter t (projection of point onto line)
  const t = Math.max(0, Math.min(1, ((x0 - x1) * dx + (y0 - y1) * dy) / (dx * dx + dy * dy)));
  
  // Find closest point on line segment
  const closestPoint = {
    lat: x1 + t * dx,
    lon: y1 + t * dy
  };
  
  return getDistance(point, closestPoint);
}

function calculateAvoidancePoint(
  from: Coordinates,
  to: Coordinates,
  obstacle: Coordinates
): Coordinates {
  // Calculate bearing from start to end
  const bearing = getRhumbLineBearing(from, to);
  
  // Calculate perpendicular bearing (90 degrees offset)
  const perpBearing = (bearing + 90) % 360;
  
  // Calculate avoidance point: 100m perpendicular to obstacle
  const avoidancePoint = computeDestinationPoint(
    obstacle,
    DANGER_ZONE_BUFFER + 50,  // 150m total
    perpBearing
  );
  
  return {
    lat: avoidancePoint.latitude,
    lon: avoidancePoint.longitude
  };
}

function calculateTotalDistance(waypoints: Coordinates[]): number {
  return waypoints.reduce((total, point, index) => {
    if (index === 0) return 0;
    return total + getDistance(waypoints[index - 1], point);
  }, 0);
}

// ============================================================================
// ROUTE UTILITIES
// ============================================================================

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export function calculateProgress(
  currentLocation: Coordinates,
  waypoints: Coordinates[]
): number {
  if (waypoints.length < 2) return 0;
  
  // Find closest waypoint segment
  let minDistance = Infinity;
  let closestSegmentIndex = 0;
  
  for (let i = 0; i < waypoints.length - 1; i++) {
    const distance = distanceFromPointToLineSegment(
      currentLocation,
      waypoints[i],
      waypoints[i + 1]
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      closestSegmentIndex = i;
    }
  }
  
  // Calculate distance covered up to closest segment
  let distanceCovered = 0;
  for (let i = 0; i < closestSegmentIndex; i++) {
    distanceCovered += getDistance(waypoints[i], waypoints[i + 1]);
  }
  
  // Add partial distance in current segment
  const segmentProgress = getDistance(waypoints[closestSegmentIndex], currentLocation);
  distanceCovered += segmentProgress;
  
  // Calculate total distance
  const totalDistance = calculateTotalDistance(waypoints);
  
  // Return progress as percentage
  return Math.min(100, (distanceCovered / totalDistance) * 100);
}

export function getRemainingDistance(
  currentLocation: Coordinates,
  waypoints: Coordinates[]
): number {
  if (waypoints.length === 0) return 0;
  
  // Find closest point on route
  let minDistance = Infinity;
  let closestSegmentIndex = 0;
  
  for (let i = 0; i < waypoints.length - 1; i++) {
    const distance = distanceFromPointToLineSegment(
      currentLocation,
      waypoints[i],
      waypoints[i + 1]
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      closestSegmentIndex = i;
    }
  }
  
  // Calculate remaining distance from current segment onwards
  let remainingDistance = 0;
  
  // Distance to end of current segment
  remainingDistance += getDistance(currentLocation, waypoints[closestSegmentIndex + 1]);
  
  // Add remaining segments
  for (let i = closestSegmentIndex + 1; i < waypoints.length - 1; i++) {
    remainingDistance += getDistance(waypoints[i], waypoints[i + 1]);
  }
  
  return remainingDistance;
}
