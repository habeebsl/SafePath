/**
 * Web-specific database implementation
 * Uses Supabase directly without local SQLite storage
 */

import { Marker, MarkerType } from '@/types/marker';
import { dbLogger } from '@/utils/logger';
import { supabase } from './supabase';

// Web doesn't use local SQLite, so these are no-ops or direct Supabase calls
let deviceId: string | null = null;

/**
 * Initialize the database (no-op on web)
 */
export async function initDatabase(): Promise<void> {
  dbLogger.info('✅ Web database initialized (using Supabase directly)');
}

/**
 * Get or create device ID
 */
export async function getDeviceId(): Promise<string> {
  if (deviceId) return deviceId;
  
  // Check localStorage for existing device ID
  const stored = localStorage.getItem('safepath_device_id');
  if (stored) {
    deviceId = stored;
    return deviceId;
  }
  
  // Generate new device ID
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  deviceId = `device_${timestamp}_${random}`;
  
  localStorage.setItem('safepath_device_id', deviceId);
  dbLogger.info('📱 Device ID:', deviceId);
  
  return deviceId;
}

/**
 * Get all markers (from Supabase)
 */
export async function getAllMarkers(): Promise<Marker[]> {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('markers')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    dbLogger.error('Error fetching markers:', error);
    return [];
  }
  
  return (data || []).map(m => ({
    id: m.id,
    type: m.type as MarkerType,
    latitude: m.latitude,
    longitude: m.longitude,
    title: m.title,
    description: m.description,
    createdBy: m.created_by,
    createdAt: m.created_at,
    lastVerified: m.last_verified,
    agrees: m.agrees,
    disagrees: m.disagrees,
    confidenceScore: m.confidence_score,
    syncedToServer: true, // Already in Supabase
  }));
}

/**
 * Add a new marker (directly to Supabase)
 */
export async function addMarker(marker: Omit<Marker, 'syncedToCloud'>): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  
  const { error } = await supabase.from('markers').insert({
    id: marker.id,
    type: marker.type,
    latitude: marker.latitude,
    longitude: marker.longitude,
    title: marker.title,
    description: marker.description,
    created_by: marker.createdBy,
    created_at: marker.createdAt,
    last_verified: marker.lastVerified,
    agrees: marker.agrees,
    disagrees: marker.disagrees,
    confidence_score: marker.confidenceScore,
  });
  
  if (error) throw error;
  dbLogger.info('✅ Marker added:', marker.id);
}

/**
 * Get a single marker by ID (from Supabase)
 */
export async function getMarkerById(markerId: string): Promise<Marker | null> {
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from('markers')
    .select('*')
    .eq('id', markerId)
    .single();
  
  if (error || !data) return null;
  
  return {
    id: data.id,
    type: data.type as MarkerType,
    latitude: data.latitude,
    longitude: data.longitude,
    title: data.title,
    description: data.description,
    createdBy: data.created_by,
    createdAt: data.created_at,
    lastVerified: data.last_verified,
    agrees: data.agrees,
    disagrees: data.disagrees,
    confidenceScore: data.confidence_score,
    syncedToServer: true,
  };
}

/**
 * Update marker vote counts (directly in Supabase)
 */
export async function updateMarkerVotes(
  markerId: string,
  agrees: number,
  disagrees: number,
  confidenceScore: number
): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  
  const { error } = await supabase
    .from('markers')
    .update({
      agrees,
      disagrees,
      confidence_score: confidenceScore,
      last_verified: Date.now(),
    })
    .eq('id', markerId);
  
  if (error) throw error;
}

/**
 * Check if user has voted on a marker
 */
export async function hasUserVoted(markerId: string, deviceId: string): Promise<boolean> {
  if (!supabase) return false;
  
  const { data, error } = await supabase
    .from('votes')
    .select('vote_type')
    .eq('marker_id', markerId)
    .eq('device_id', deviceId)
    .single();
  
  return !error && !!data;
}

/**
 * Get user's vote for a marker
 */
export async function getUserVote(
  markerId: string,
  deviceId: string
): Promise<'agree' | 'disagree' | null> {
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from('votes')
    .select('vote_type')
    .eq('marker_id', markerId)
    .eq('device_id', deviceId)
    .single();
  
  if (error || !data) return null;
  
  return data.vote_type as 'agree' | 'disagree';
}

/**
 * Add a vote
 */
export async function addVote(
  markerId: string,
  deviceId: string,
  voteType: 'agree' | 'disagree'
): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  
  const { error } = await supabase.from('votes').insert({
    marker_id: markerId,
    device_id: deviceId,
    vote_type: voteType,
    timestamp: Date.now(),
  });
  
  if (error) throw error;
}

/**
 * Get active SOS markers (from Supabase)
 */
export async function getActiveSOSMarkers(): Promise<any[]> {
  if (!supabase) return [];
  
  const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
  
  const { data, error } = await supabase
    .from('sos_markers')
    .select('*')
    .eq('status', 'active')
    .gt('created_at', twentyFourHoursAgo)
    .order('created_at', { ascending: false });
  
  if (error) {
    dbLogger.error('Error fetching SOS markers:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Create SOS marker (directly in Supabase)
 */
export async function createSOSMarker(sos: {
  id: string;
  latitude: number;
  longitude: number;
  createdBy: string;
  createdAt: number;
}): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  
  const { error } = await supabase.from('sos_markers').insert({
    id: sos.id,
    latitude: sos.latitude,
    longitude: sos.longitude,
    created_by: sos.createdBy,
    created_at: sos.createdAt,
    status: 'active',
    expires_at: null,
  });
  
  if (error) throw error;
  dbLogger.info('✅ SOS marker created:', sos.id);
}

/**
 * Complete SOS marker (directly in Supabase)
 */
export async function completeSOSMarker(sosId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  
  const completedAt = Date.now();
  const expiresAt = completedAt + (5 * 60 * 1000);
  
  // Update the SOS marker status (no completed_at column in Supabase)
  const { error: markerError } = await supabase
    .from('sos_markers')
    .update({
      status: 'completed',
      expires_at: expiresAt,
    })
    .eq('id', sosId);
  
  if (markerError) throw markerError;
  
  // Cancel all active responses for this SOS
  const { error: responsesError } = await supabase
    .from('sos_responses')
    .update({
      status: 'cancelled',
      updated_at: completedAt,
    })
    .eq('sos_marker_id', sosId)
    .eq('status', 'active');
  
  if (responsesError) {
    dbLogger.error('Error cancelling responses for completed SOS:', responsesError);
    // Don't throw - marker was already completed
  }
  
  dbLogger.info('✅ SOS marker completed and all responses cancelled:', sosId);
}

/**
 * Delete SOS marker (from Supabase)
 */
export async function deleteSOSMarker(sosId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  
  await supabase.from('sos_responses').delete().eq('sos_marker_id', sosId);
  await supabase.from('sos_markers').delete().eq('id', sosId);
  
  dbLogger.info('✅ SOS marker deleted:', sosId);
}

/**
 * Get user's active SOS request
 */
export async function getUserActiveSOSRequest(deviceId: string): Promise<any | null> {
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from('sos_markers')
    .select('*')
    .eq('created_by', deviceId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error) return null;
  return data;
}

/**
 * Get SOS responses for a marker
 */
export async function getSOSResponses(sosMarkerId: string): Promise<any[]> {
  if (!supabase) return [];
  
  const { data, error } = await supabase
    .from('sos_responses')
    .select('*')
    .eq('sos_marker_id', sosMarkerId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  
  if (error) return [];
  return data || [];
}

/**
 * Add SOS response
 */
export async function addSOSResponse(response: {
  sosMarkerId: string;
  responderDeviceId: string;
  currentLatitude: number;
  currentLongitude: number;
  distanceMeters: number;
  etaMinutes: number;
}): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  
  const id = `response_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  const now = Date.now();
  
  const { error } = await supabase.from('sos_responses').insert({
    id,
    sos_marker_id: response.sosMarkerId,
    responder_device_id: response.responderDeviceId,
    current_latitude: response.currentLatitude,
    current_longitude: response.currentLongitude,
    distance_meters: response.distanceMeters,
    eta_minutes: response.etaMinutes,
    status: 'active',
    created_at: now,
    updated_at: now,
  });
  
  if (error) throw error;
  dbLogger.info('✅ SOS response added');
}

/**
 * Get user's active SOS response
 */
export async function getUserActiveSOSResponse(deviceId: string): Promise<any | null> {
  if (!supabase) return null;
  
  const { data, error } = await supabase
    .from('sos_responses')
    .select('*')
    .eq('responder_device_id', deviceId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error) return null;
  return data;
}

/**
 * Update responder location
 */
export async function updateResponderLocation(
  sosMarkerId: string,
  responderDeviceId: string,
  latitude: number,
  longitude: number,
  distanceMeters: number,
  etaMinutes: number
): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  
  const { error } = await supabase
    .from('sos_responses')
    .update({
      current_latitude: latitude,
      current_longitude: longitude,
      distance_meters: distanceMeters,
      eta_minutes: etaMinutes,
      updated_at: Date.now(),
    })
    .eq('sos_marker_id', sosMarkerId)
    .eq('responder_device_id', responderDeviceId);
  
  if (error) throw error;
}

/**
 * Cancel SOS response
 */
export async function cancelSOSResponse(sosMarkerId: string, responderDeviceId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  
  const { error } = await supabase
    .from('sos_responses')
    .update({
      status: 'cancelled',
      updated_at: Date.now(),
    })
    .eq('sos_marker_id', sosMarkerId)
    .eq('responder_device_id', responderDeviceId);
  
  if (error) throw error;
  dbLogger.info('✅ SOS response cancelled');
}

/**
 * Mark responder as arrived
 */
export async function markResponderArrived(sosMarkerId: string, responderDeviceId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured');
  
  const { error } = await supabase
    .from('sos_responses')
    .update({
      status: 'arrived',
      updated_at: Date.now(),
    })
    .eq('sos_marker_id', sosMarkerId)
    .eq('responder_device_id', responderDeviceId);
  
  if (error) throw error;
  dbLogger.info('✅ Responder marked as arrived');
}

// No-op functions for compatibility with native code
export async function deleteCompletedSOSMarkers(): Promise<number> {
  return 0; // Web doesn't have local storage to clean
}

/**
 * Clean up orphaned SOS responses (responses to completed or non-existent SOS)
 * This fixes the "already responding to another SOS" bug
 */
export async function cleanupOrphanedSOSResponses(deviceId: string): Promise<void> {
  if (!supabase) return;
  
  try {
    // Get all active responses for this device
    const { data: activeResponses, error: fetchError } = await supabase
      .from('sos_responses')
      .select('sos_marker_id')
      .eq('responder_device_id', deviceId)
      .eq('status', 'active');
    
    if (fetchError || !activeResponses || activeResponses.length === 0) return;
    
    // Check which SOS markers still exist and are active
    const sosIds = activeResponses.map(r => r.sos_marker_id);
    const { data: activeMarkers } = await supabase
      .from('sos_markers')
      .select('id')
      .in('id', sosIds)
      .eq('status', 'active');
    
    const activeMarkerIds = new Set(activeMarkers?.map(m => m.id) || []);
    
    // Cancel responses to completed/deleted SOS
    const orphanedIds = sosIds.filter(id => !activeMarkerIds.has(id));
    
    if (orphanedIds.length > 0) {
      const { error: cancelError } = await supabase
        .from('sos_responses')
        .update({
          status: 'cancelled',
          updated_at: Date.now(),
        })
        .eq('responder_device_id', deviceId)
        .in('sos_marker_id', orphanedIds)
        .eq('status', 'active');
      
      if (!cancelError) {
        dbLogger.info('🧹 Cleaned up', orphanedIds.length, 'orphaned SOS response(s)');
      }
    }
  } catch (error) {
    dbLogger.error('Error cleaning up orphaned responses:', error);
  }
}

export async function getAllSOSMarkersDebug(): Promise<any[]> {
  // Not applicable for web
  return [];
}

export async function deleteAllSOSMarkers(): Promise<number> {
  return 0; // Web doesn't have local storage
}

// Stub exports for functions that don't apply to web
export const getUnsyncedMarkers = async () => [];
export const getUnsyncedSOSMarkers = async () => [];
export const getUnsyncedSOSResponses = async () => [];
export const markMarkerAsSynced = async () => {};
export const markSOSMarkerAsSynced = async () => {};
export const markSOSResponseAsSynced = async () => {};
export const upsertMarker = async () => {};
export const upsertSOSMarker = async () => {};
export const upsertSOSResponse = async () => {};
