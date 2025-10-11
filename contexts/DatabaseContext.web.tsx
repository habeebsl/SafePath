/**
 * Web-specific Database Context
 * Provides database state using Supabase directly (no SQLite)
 */

import { Marker } from '@/types/marker';
import {
    addVote,
    addMarker as dbAddMarker,
    getAllMarkers,
    getDeviceId,
    getUserVote,
    initDatabase,
    updateMarkerVotes
} from '@/utils/database';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface DatabaseContextType {
  isReady: boolean;
  deviceId: string | null;
  markers: Marker[];
  refreshMarkers: () => Promise<void>;
  addMarker: (marker: Marker) => Promise<void>;
  voteOnMarker: (markerId: string, vote: 'agree' | 'disagree') => Promise<void>;
  getUserVoteForMarker: (markerId: string) => Promise<'agree' | 'disagree' | null>;
  triggerSync: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType | null>(null);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [markers, setMarkers] = useState<Marker[]>([]);

  // Initialize database on mount
  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        console.log('🔧 [Web] Initializing database...');
        await initDatabase();
        
        const id = await getDeviceId();
        if (mounted) {
          setDeviceId(id);
          console.log('📱 [Web] Device ID:', id);
        }

        const allMarkers = await getAllMarkers();
        if (mounted) {
          setMarkers(allMarkers);
          console.log(`📍 [Web] Loaded ${allMarkers.length} markers from Supabase`);
        }

        if (mounted) {
          setIsReady(true);
          console.log('✅ [Web] Database ready');
        }
      } catch (error) {
        console.error('❌ [Web] Database initialization error:', error);
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
  }, []);

  // Refresh markers from Supabase
  const refreshMarkers = useCallback(async () => {
    try {
      const allMarkers = await getAllMarkers();
      setMarkers(allMarkers);
      console.log(`🔄 [Web] Refreshed ${allMarkers.length} markers`);
    } catch (error) {
      console.error('❌ [Web] Error refreshing markers:', error);
    }
  }, []);

  // Add a new marker
  const addMarker = useCallback(async (marker: Marker) => {
    try {
      await dbAddMarker(marker);
      await refreshMarkers();
      console.log('✅ [Web] Marker added:', marker.id);
    } catch (error) {
      console.error('❌ [Web] Error adding marker:', error);
      throw error;
    }
  }, [refreshMarkers]);

  // Vote on a marker
  const voteOnMarker = useCallback(async (markerId: string, vote: 'agree' | 'disagree') => {
    if (!deviceId) {
      throw new Error('Device ID not available');
    }

    try {
      // Find the marker
      const marker = markers.find(m => m.id === markerId);
      if (!marker) {
        throw new Error('Marker not found');
      }

      // Check if user created this marker
      if (marker.createdBy === deviceId) {
        throw new Error('You cannot vote on markers you created');
      }

      // Check if user already voted
      const existingVote = await getUserVote(markerId, deviceId);
      if (existingVote) {
        throw new Error('You have already voted on this marker');
      }

      // Calculate new vote counts
      const newAgrees = vote === 'agree' ? marker.agrees + 1 : marker.agrees;
      const newDisagrees = vote === 'disagree' ? marker.disagrees + 1 : marker.disagrees;
      const totalVotes = newAgrees + newDisagrees;
      const newConfidenceScore = Math.round((newAgrees / totalVotes) * 100);

      // Update database
      await updateMarkerVotes(markerId, newAgrees, newDisagrees, newConfidenceScore);
      await addVote(markerId, deviceId, vote);
      await refreshMarkers();

      console.log(`✅ [Web] Voted ${vote} on marker ${markerId}`);
    } catch (error) {
      console.error('❌ [Web] Error voting on marker:', error);
      throw error;
    }
  }, [deviceId, markers, refreshMarkers]);

  // Get user's vote for a marker
  const getUserVoteForMarker = useCallback(async (markerId: string): Promise<'agree' | 'disagree' | null> => {
    if (!deviceId) return null;
    
    try {
      const vote = await getUserVote(markerId, deviceId);
      return vote;
    } catch (error) {
      console.error('❌ [Web] Error getting user vote:', error);
      return null;
    }
  }, [deviceId]);

  // Trigger sync (no-op on web since we use Supabase directly)
  const triggerSync = useCallback(async () => {
    console.log('🔄 [Web] Manual sync triggered (refreshing markers)');
    await refreshMarkers();
  }, [refreshMarkers]);

  const value: DatabaseContextType = {
    isReady,
    deviceId,
    markers,
    refreshMarkers,
    addMarker,
    voteOnMarker,
    getUserVoteForMarker,
    triggerSync,
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (context === null) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}
