/**
 * SOS System Types
 */

export interface SOSMarker {
  id: string;
  latitude: number;
  longitude: number;
  createdBy: string;
  createdAt: number;
  status: 'active' | 'completed';
  completedAt?: number;
  expiresAt?: number;
  syncedToCloud: boolean;
}

export interface SOSResponse {
  id: string;
  sosMarkerId: string;
  responderDeviceId: string;
  createdAt: number;
  updatedAt: number;
  currentLatitude: number | null;
  currentLongitude: number | null;
  distanceMeters: number | null;
  etaMinutes: number | null;
  status: 'active' | 'cancelled' | 'arrived';
  syncedToCloud: boolean;
}

export interface SOSNotification {
  sosMarker: SOSMarker;
  distance: number;
  respondersCount: number;
}

// Supabase types
export type SupabaseSOSMarker = {
  id: string;
  latitude: number;
  longitude: number;
  created_by: string;
  created_at: number;
  status: 'active' | 'completed';
  expires_at: number | null;
};

export type SupabaseSOSResponse = {
  id: string;
  sos_marker_id: string;
  responder_device_id: string;
  created_at: number;
  updated_at: number;
  current_latitude: number | null;
  current_longitude: number | null;
  distance_meters: number | null;
  eta_minutes: number | null;
  status: 'active' | 'cancelled' | 'arrived';
};

// Constants
export const SOS_PROXIMITY_RADIUS = 5000; // 5km
export const SOS_MAX_RESPONDERS = 5;
export const SOS_COOLDOWN_MINUTES = 10;
export const SOS_COMPLETION_DELAY = 5 * 60 * 1000; // 5 minutes
export const SOS_ARRIVAL_THRESHOLD = 50; // meters
