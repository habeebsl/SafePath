/**
 * Trail Types for SafePath
 * 
 * Defines the structure for navigation trails on the map
 */

import { Route } from '@/utils/routing';
import { Coordinates, Marker } from './marker';

export enum TrailContext {
  SOS_RESPONSE = 'sos_response',
  NAVIGATE_TO_SAFE = 'safe_zone',
  EVACUATE = 'evacuation',
  AVOID_DANGER = 'avoid_danger',
  CUSTOM = 'custom'
}

export interface Trail {
  id: string;
  
  // Route information
  from: Coordinates;
  to: Coordinates;
  route: Route;  // Includes waypoints, distance, duration
  
  // Context
  context: TrailContext;
  targetMarker: Marker;
  
  // Visual styling
  color: string;
  
  // State
  isActive: boolean;
  createdAt: string;
  
  // Real-time tracking
  currentProgress: number;  // 0-100%
  distanceRemaining: number;  // Meters
  etaMinutes: number;  // Minutes
  
  // User actions
  startedAt?: string;
  arrivedAt?: string;
}

export interface TrailPriority {
  level: number;
  requiresConfirmation: boolean;
  abandonmentWarning?: string;
}

// Priority levels for different trail contexts
export const TRAIL_PRIORITIES: Record<TrailContext, TrailPriority> = {
  [TrailContext.SOS_RESPONSE]: {
    level: 4,
    requiresConfirmation: true,
    abandonmentWarning: "Someone is counting on your help! Are you sure you want to cancel?"
  },
  
  [TrailContext.EVACUATE]: {
    level: 3,
    requiresConfirmation: true,
    abandonmentWarning: "This is an evacuation route. Are you sure?"
  },
  
  [TrailContext.NAVIGATE_TO_SAFE]: {
    level: 2,
    requiresConfirmation: true,
    abandonmentWarning: undefined
  },
  
  [TrailContext.AVOID_DANGER]: {
    level: 2,
    requiresConfirmation: true,
    abandonmentWarning: undefined
  },
  
  [TrailContext.CUSTOM]: {
    level: 1,
    requiresConfirmation: false,
    abandonmentWarning: undefined
  }
};

// Visual styles for different trail types
export interface TrailStyle {
  color: string;
  width: number;
  opacity: number;
  label: string;
}

export const TRAIL_STYLES: Record<TrailContext, TrailStyle> = {
  [TrailContext.SOS_RESPONSE]: {
    color: '#FF3B30',
    width: 5,
    opacity: 0.9,
    label: '🚨 Responding to SOS'
  },
  
  [TrailContext.NAVIGATE_TO_SAFE]: {
    color: '#34C759',
    width: 4,
    opacity: 0.8,
    label: '🏃 To Safe Zone'
  },
  
  [TrailContext.EVACUATE]: {
    color: '#FF9500',
    width: 6,
    opacity: 0.9,
    label: '⚠️ Evacuation Route'
  },
  
  [TrailContext.AVOID_DANGER]: {
    color: '#FF3B30',
    width: 3,
    opacity: 0.7,
    label: '🚫 Avoiding Danger'
  },
  
  [TrailContext.CUSTOM]: {
    color: '#007AFF',
    width: 3,
    opacity: 0.7,
    label: '📍 Custom Route'
  }
};

// Arrival threshold (meters)
export const ARRIVAL_THRESHOLD = 50;

// Route recalculation threshold (meters off route)
export const OFF_ROUTE_THRESHOLD = 100;
