import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Get Supabase credentials from environment
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials not configured. Cloud sync will be disabled.');
}

// Create Supabase client
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false, // We're using device-based identity, not user accounts
      },
    })
  : null;

export const isSupabaseConfigured = !!supabase;

// Database types for Supabase
export type SupabaseMarker = {
  id: string;
  type: string;
  latitude: number;
  longitude: number;
  title: string;
  description: string | null;
  created_by: string;
  created_at: number;
  last_verified: number;
  agrees: number;
  disagrees: number;
  confidence_score: number;
};

export type SupabaseVote = {
  id?: number;
  marker_id: string;
  device_id: string;
  vote_type: 'agree' | 'disagree';
  timestamp: number;
};
