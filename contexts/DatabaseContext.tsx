import { Marker } from '@/types/marker';
import { addVote, addMarker as dbAddMarker, getAllMarkers, getDeviceId, getUserVote, initDatabase, updateMarkerVotes } from '@/utils/database';
import { manualSync, startSyncService, stopSyncService } from '@/utils/sync';
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
        console.log('🔧 Initializing database...');
        await initDatabase();
        
        const id = await getDeviceId();
        if (mounted) {
          setDeviceId(id);
          console.log('📱 Device ID:', id);
        }

        const allMarkers = await getAllMarkers();
        if (mounted) {
          setMarkers(allMarkers);
          console.log(`📍 Loaded ${allMarkers.length} markers from database`);
        }

        // Start sync service
        startSyncService();

        if (mounted) {
          setIsReady(true);
          console.log('✅ Database ready');
        }
      } catch (error) {
        console.error('❌ Database initialization error:', error);
      }
    };

    initialize();

    return () => {
      mounted = false;
      stopSyncService();
    };
  }, []);

  // Refresh markers from database
  const refreshMarkers = useCallback(async () => {
    try {
      const allMarkers = await getAllMarkers();
      setMarkers(allMarkers);
      console.log(`🔄 Refreshed ${allMarkers.length} markers`);
    } catch (error) {
      console.error('❌ Error refreshing markers:', error);
    }
  }, []);

  // Add a new marker
  const addMarker = useCallback(async (marker: Marker) => {
    if (!isReady) {
      console.warn('⚠️ Database not ready yet');
      throw new Error('Database not ready. Please wait a moment and try again.');
    }

    try {
      console.log('📝 Adding marker to database...');
      await dbAddMarker(marker);
      await refreshMarkers();
      console.log('✅ Marker added successfully');
    } catch (error) {
      console.error('❌ Error adding marker:', error);
      throw error;
    }
  }, [refreshMarkers, isReady]);

  // Vote on a marker
  const voteOnMarker = useCallback(async (markerId: string, vote: 'agree' | 'disagree') => {
    if (!isReady) {
      throw new Error('Database not ready. Please wait a moment and try again.');
    }

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

      // Update votes
      const newAgrees = vote === 'agree' ? marker.agrees + 1 : marker.agrees;
      const newDisagrees = vote === 'disagree' ? marker.disagrees + 1 : marker.disagrees;
      const totalVotes = newAgrees + newDisagrees;
      const newConfidenceScore = Math.round((newAgrees / totalVotes) * 100);

      // Update database
      await updateMarkerVotes(markerId, newAgrees, newDisagrees, newConfidenceScore);
      await addVote(markerId, deviceId, vote);

      // Refresh markers
      await refreshMarkers();

      console.log('✅ Vote recorded successfully');
    } catch (error) {
      console.error('❌ Error voting on marker:', error);
      throw error;
    }
  }, [deviceId, markers, refreshMarkers, isReady]);

  // Get user's vote for a marker
  const getUserVoteForMarker = useCallback(async (markerId: string): Promise<'agree' | 'disagree' | null> => {
    if (!deviceId) return null;
    
    try {
      return await getUserVote(markerId, deviceId);
    } catch (error) {
      console.error('❌ Error getting user vote:', error);
      return null;
    }
  }, [deviceId]);

  // Manually trigger sync
  const triggerSync = useCallback(async () => {
    try {
      await manualSync();
      await refreshMarkers();
      console.log('✅ Manual sync completed');
    } catch (error) {
      console.error('❌ Manual sync error:', error);
      throw error;
    }
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
  if (!context) {
    throw new Error('useDatabase must be used within DatabaseProvider');
  }
  return context;
}
