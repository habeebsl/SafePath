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
import { uiLogger } from '@/utils/logger';

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
        uiLogger.info('🔧 [Web] Initializing database...');
        await initDatabase();
        
        const id = await getDeviceId();
        if (mounted) {
          setDeviceId(id);
          uiLogger.info('📱 [Web] Device ID:', id);
        }

        const allMarkers = await getAllMarkers();
        if (mounted) {
          setMarkers(allMarkers);
          uiLogger.info(`📍 [Web] Loaded ${allMarkers.length} markers from Supabase`);
        }

        if (mounted) {
          setIsReady(true);
          uiLogger.info('✅ [Web] Database ready');
        }
      } catch (error) {
        uiLogger.error('❌ [Web] Database initialization error:', error);
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
      uiLogger.info(`🔄 [Web] Refreshed ${allMarkers.length} markers`);
    } catch (error) {
      uiLogger.error('❌ [Web] Error refreshing markers:', error);
    }
  }, []);

  // Add a new marker
  const addMarker = useCallback(async (marker: Marker) => {
    try {
      await dbAddMarker(marker);
      await refreshMarkers();
      uiLogger.info('✅ [Web] Marker added:', marker.id);
    } catch (error) {
      uiLogger.error('❌ [Web] Error adding marker:', error);
      throw error;
    }
  }, [refreshMarkers]);

  // Vote on a marker
  const voteOnMarker = useCallback(async (markerId: string, vote: 'agree' | 'disagree') => {
    if (!deviceId) {
      throw new Error('Device ID not available');
    }

    try {
      // Get fresh marker data directly from database (not from state)
      const { getMarkerById } = await import('@/utils/database');
      const marker = await getMarkerById(markerId);
      
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

      // Calculate new vote counts based on CURRENT database values
      const newAgrees = vote === 'agree' ? marker.agrees + 1 : marker.agrees;
      const newDisagrees = vote === 'disagree' ? marker.disagrees + 1 : marker.disagrees;
      const totalVotes = newAgrees + newDisagrees;
      const newConfidenceScore = Math.round((newAgrees / totalVotes) * 100);

      // Update database
      uiLogger.info(`📝 [Web] Updating marker ${markerId}: agrees=${newAgrees}, disagrees=${newDisagrees} (was agrees=${marker.agrees}, disagrees=${marker.disagrees})`);
      await updateMarkerVotes(markerId, newAgrees, newDisagrees, newConfidenceScore);
      await addVote(markerId, deviceId, vote);
      await refreshMarkers();

      uiLogger.info(`✅ [Web] Voted ${vote} on marker ${markerId}`);
    } catch (error) {
      uiLogger.error('❌ [Web] Error voting on marker:', error);
      throw error;
    }
  }, [deviceId, refreshMarkers]);

  // Get user's vote for a marker
  const getUserVoteForMarker = useCallback(async (markerId: string): Promise<'agree' | 'disagree' | null> => {
    if (!deviceId) return null;
    
    try {
      const vote = await getUserVote(markerId, deviceId);
      return vote;
    } catch (error) {
      uiLogger.error('❌ [Web] Error getting user vote:', error);
      return null;
    }
  }, [deviceId]);

  // Trigger sync (no-op on web since we use Supabase directly)
  const triggerSync = useCallback(async () => {
    uiLogger.info('🔄 [Web] Manual sync triggered (refreshing markers)');
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
