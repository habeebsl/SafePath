/**
 * SOS Context for SafePath
 * Manages SOS requests and responses
 */

import { Alert } from '@/components/Alert';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useLocation } from '@/contexts/LocationContext';
import {
  SOS_ARRIVAL_THRESHOLD,
  SOS_COOLDOWN_MINUTES,
  SOS_MAX_RESPONDERS,
  SOS_PROXIMITY_RADIUS,
  SOSMarker,
  SOSNotification,
  SOSResponse
} from '@/types/sos';
import {
  addSOSResponse,
  cleanupOrphanedSOSResponses,
  cancelSOSResponse as dbCancelSOSResponse,
  completeSOSMarker as dbCompleteSOSMarker,
  createSOSMarker as dbCreateSOSMarker,
  deleteSOSMarker,
  getActiveSOSMarkers,
  getAllSOSMarkersDebug,
  getDeviceId,
  getSOSResponses,
  getUserActiveSOSRequest,
  getUserActiveSOSResponse,
  updateResponderLocation,
} from '@/utils/database';
import { uiLogger } from '@/utils/logger';
import { getDistance } from 'geolib';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

interface SOSContextType {
  activeSOSMarkers: SOSMarker[];
  myActiveSOSRequest: SOSMarker | null;
  myActiveSOSResponse: SOSResponse | null;
  nearbySOSNotifications: SOSNotification[];
  
  createSOSRequest: () => Promise<void>;
  completeSOSRequest: (sosId: string) => Promise<void>;
  respondToSOS: (sosId: string) => Promise<void>;
  cancelSOSResponse: (sosId: string) => Promise<void>;
  getSOSResponsesForMarker: (sosId: string) => Promise<SOSResponse[]>;
  dismissSOSNotification: (sosId: string) => void;
  
  refreshSOS: () => Promise<void>;
  isCreatingSOS: boolean;
}

const SOSContext = createContext<SOSContextType | undefined>(undefined);

export function SOSProvider({ children }: { children: React.ReactNode }) {
  const { isReady: dbReady } = useDatabase();
  const { location } = useLocation();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  
  const [activeSOSMarkers, setActiveSOSMarkers] = useState<SOSMarker[]>([]);
  const [myActiveSOSRequest, setMyActiveSOSRequest] = useState<SOSMarker | null>(null);
  const [myActiveSOSResponse, setMyActiveSOSResponse] = useState<SOSResponse | null>(null);
  const [nearbySOSNotifications, setNearbySOSNotifications] = useState<SOSNotification[]>([]);
  const [isCreatingSOS, setIsCreatingSOS] = useState(false);
  const [lastSOSCreatedAt, setLastSOSCreatedAt] = useState<number>(0);
  const [notifiedSOSIds, setNotifiedSOSIds] = useState<Set<string>>(new Set()); // Track which SOS we've already notified
  const [dismissedSOSIds, setDismissedSOSIds] = useState<Set<string>>(new Set()); // Track which SOS user dismissed

  // Initialize device ID when database is ready
  useEffect(() => {
    if (dbReady && !deviceId) {
      getDeviceId().then(setDeviceId);
    }
  }, [dbReady, deviceId]);

    // One-time cleanup on mount: remove any completed markers from local DB
  useEffect(() => {
    if (!dbReady) return;
    
    const cleanupMarkers = async () => {
      try {
        const { deleteCompletedSOSMarkers } = await import('@/utils/database');
        const completedCount = await deleteCompletedSOSMarkers();
        
        if (completedCount > 0) {
          uiLogger.info('🧹 Cleaned up', completedCount, 'completed SOS markers from local DB');
        }
      } catch (error) {
        uiLogger.error('Error cleaning up markers:', error);
      }
    };
    
    cleanupMarkers();
  }, [dbReady]);

  // Load SOS data on mount and refresh periodically
  useEffect(() => {
    if (!dbReady || !deviceId) return;
    
    const doRefresh = async () => {
      try {
        // Debug: Check ALL markers in local DB
        const allMarkers = await getAllSOSMarkersDebug();
        if (allMarkers.length > 0) {
          uiLogger.info('🔍 ALL SOS in local DB:', allMarkers.length,
            allMarkers.map((m: any) => `${m.id.substring(0, 8)}:${m.status}`).join(', '));
        }
        
        const markers = await getActiveSOSMarkers();
        uiLogger.info('🔄 Refreshing SOS - found active markers:', markers.length, 
          markers.map(m => `${m.id.substring(0, 8)}:${m.status}`).join(', '));
        setActiveSOSMarkers(markers.map(m => ({
          id: m.id,
          latitude: m.latitude,
          longitude: m.longitude,
          createdBy: m.created_by,
          createdAt: m.created_at,
          status: m.status as 'active' | 'completed',
          completedAt: m.completed_at,
          expiresAt: m.expires_at,
          syncedToCloud: m.synced_to_cloud === 1
        })));

        const myRequest = await getUserActiveSOSRequest(deviceId);
        uiLogger.info('🔄 My active SOS:', myRequest ? myRequest.id : 'none');
        setMyActiveSOSRequest(myRequest ? {
          id: myRequest.id,
          latitude: myRequest.latitude,
          longitude: myRequest.longitude,
          createdBy: myRequest.created_by,
          createdAt: myRequest.created_at,
          status: myRequest.status as 'active' | 'completed',
          completedAt: myRequest.completed_at,
          expiresAt: myRequest.expires_at,
          syncedToCloud: myRequest.synced_to_cloud === 1
        } : null);

        const myResponse = await getUserActiveSOSResponse(deviceId);
        setMyActiveSOSResponse(myResponse ? {
          id: myResponse.id,
          sosMarkerId: myResponse.sos_marker_id,
          responderDeviceId: myResponse.responder_device_id,
          createdAt: myResponse.created_at,
          updatedAt: myResponse.updated_at,
          currentLatitude: myResponse.current_latitude,
          currentLongitude: myResponse.current_longitude,
          distanceMeters: myResponse.distance_meters,
          etaMinutes: myResponse.eta_minutes,
          status: myResponse.status as 'active' | 'cancelled' | 'arrived',
          syncedToCloud: myResponse.synced_to_cloud === 1
        } : null);
      } catch (error) {
        uiLogger.error('Error refreshing SOS data:', error);
      }
    };
    
    doRefresh();
    
    const interval = setInterval(() => {
      doRefresh();
    }, 3000); // Refresh every 3 seconds for faster real-time updates
    
    return () => clearInterval(interval);
  }, [dbReady, deviceId]);

  // Cleanup expired SOS markers
  useEffect(() => {
    const interval = setInterval(() => {
      cleanupExpiredSOS();
    }, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, [activeSOSMarkers]);

  // Update responder location if user is responding
  useEffect(() => {
    if (!location || !myActiveSOSResponse || !deviceId) return;

    const updateInterval = setInterval(async () => {
      try {
        // Find the SOS marker
        const sosMarker = activeSOSMarkers.find(m => m.id === myActiveSOSResponse.sosMarkerId);
        if (!sosMarker) return;

        // Calculate distance and ETA
        const distance = getDistance(
          { latitude: location.coords.latitude, longitude: location.coords.longitude },
          { latitude: sosMarker.latitude, longitude: sosMarker.longitude }
        );

        const etaMinutes = Math.ceil(distance / 1.39 / 60); // Walking speed 5km/h

        // Update database
        await updateResponderLocation(
          myActiveSOSResponse.sosMarkerId,
          deviceId,
          location.coords.latitude,
          location.coords.longitude,
          distance,
          etaMinutes
        );

        // Update local state
        setMyActiveSOSResponse(prev => prev ? {
          ...prev,
          currentLatitude: location.coords.latitude,
          currentLongitude: location.coords.longitude,
          distanceMeters: distance,
          etaMinutes
        } : null);

        // Check if arrived
        if (distance <= SOS_ARRIVAL_THRESHOLD) {
          handleArrival(myActiveSOSResponse.sosMarkerId);
        }

      } catch (error) {
        uiLogger.error('Error updating responder location:', error);
      }
    }, 10000); // Update every 10 seconds

    return () => clearInterval(updateInterval);
  }, [location, myActiveSOSResponse, activeSOSMarkers, deviceId]);

  // Detect nearby SOS markers
  useEffect(() => {
    if (!location || !deviceId) return;

    const processNearby = async () => {
      const nearby: SOSNotification[] = [];
      let hasNotifiedChanges = false;
      let hasDismissedChanges = false;
      const newNotifiedIds = new Set(notifiedSOSIds);
      const newDismissedIds = new Set(dismissedSOSIds);

      for (const sosMarker of activeSOSMarkers) {
        // Skip if it's my own SOS request
        if (sosMarker.createdBy === deviceId) continue;

        // Skip if I'm already responding
        if (myActiveSOSResponse && myActiveSOSResponse.sosMarkerId === sosMarker.id) continue;

        // Skip if user dismissed this notification
        if (dismissedSOSIds.has(sosMarker.id)) continue;

        const distance = getDistance(
          { latitude: location.coords.latitude, longitude: location.coords.longitude },
          { latitude: sosMarker.latitude, longitude: sosMarker.longitude }
        );

        if (distance <= SOS_PROXIMITY_RADIUS && sosMarker.status === 'active') {
          const responses = await getSOSResponses(sosMarker.id);
          
          // Only log if we haven't notified about this SOS before
          if (!notifiedSOSIds.has(sosMarker.id)) {
            uiLogger.info('🚨 New nearby SOS detected:', sosMarker.id.substring(0, 12), `${Math.round(distance)}m away`);
            newNotifiedIds.add(sosMarker.id);
            hasNotifiedChanges = true;
          }
          
          nearby.push({
            sosMarker,
            distance,
            respondersCount: responses.length
          });
        }
      }

      // Clean up notified/dismissed IDs for SOS that are no longer active
      const activeIds = new Set(activeSOSMarkers.map(m => m.id));
      for (const id of notifiedSOSIds) {
        if (!activeIds.has(id)) {
          newNotifiedIds.delete(id);
          hasNotifiedChanges = true;
          uiLogger.info('🧹 Clearing notification history for inactive SOS:', id.substring(0, 12));
        }
      }
      for (const id of dismissedSOSIds) {
        if (!activeIds.has(id)) {
          newDismissedIds.delete(id);
          hasDismissedChanges = true;
          uiLogger.info('🧹 Clearing dismissed history for inactive SOS:', id.substring(0, 12));
        }
      }

      // Only update state if there are actual changes
      if (hasNotifiedChanges) {
        setNotifiedSOSIds(newNotifiedIds);
      }
      if (hasDismissedChanges) {
        setDismissedSOSIds(newDismissedIds);
      }
      setNearbySOSNotifications(nearby);
    };

    processNearby();
  }, [location, activeSOSMarkers, deviceId, myActiveSOSResponse]);

  /**
   * Refresh all SOS data from database
   */
  const refreshSOS = useCallback(async () => {
    if (!deviceId) return;

    try {
      // Clean up orphaned responses first (both web and native)
      await cleanupOrphanedSOSResponses(deviceId);
      
      // Get all active SOS markers
      const markers = await getActiveSOSMarkers();
      uiLogger.info('🔄 Refreshing SOS - found markers:', markers.length);
      setActiveSOSMarkers(markers.map(m => ({
        id: m.id,
        latitude: m.latitude,
        longitude: m.longitude,
        createdBy: m.created_by,
        createdAt: m.created_at,
        status: m.status as 'active' | 'completed',
        completedAt: m.completed_at,
        expiresAt: m.expires_at,
        syncedToCloud: m.synced_to_cloud === 1
      })));

      // Get my active SOS request
      const myRequest = await getUserActiveSOSRequest(deviceId);
      uiLogger.info('🔄 My active SOS:', myRequest ? myRequest.id : 'none');
      setMyActiveSOSRequest(myRequest ? {
        id: myRequest.id,
        latitude: myRequest.latitude,
        longitude: myRequest.longitude,
        createdBy: myRequest.created_by,
        createdAt: myRequest.created_at,
        status: myRequest.status as 'active' | 'completed',
        completedAt: myRequest.completed_at,
        expiresAt: myRequest.expires_at,
        syncedToCloud: myRequest.synced_to_cloud === 1
      } : null);

      // Get my active response
      const myResponse = await getUserActiveSOSResponse(deviceId);
      setMyActiveSOSResponse(myResponse ? {
        id: myResponse.id,
        sosMarkerId: myResponse.sos_marker_id,
        responderDeviceId: myResponse.responder_device_id,
        createdAt: myResponse.created_at,
        updatedAt: myResponse.updated_at,
        currentLatitude: myResponse.current_latitude,
        currentLongitude: myResponse.current_longitude,
        distanceMeters: myResponse.distance_meters,
        etaMinutes: myResponse.eta_minutes,
        status: myResponse.status as 'active' | 'cancelled' | 'arrived',
        syncedToCloud: myResponse.synced_to_cloud === 1
      } : null);

    } catch (error) {
      uiLogger.error('Error refreshing SOS data:', error);
    }
  }, [deviceId]);

  /**
   * Create a new SOS request
   */
  const createSOSRequest = useCallback(async () => {
    if (!location || !deviceId) {
      Alert.alert('Error', 'Unable to get your current location');
      return;
    }

    // Check cooldown
    const timeSinceLastSOS = Date.now() - lastSOSCreatedAt;
    const cooldownMs = SOS_COOLDOWN_MINUTES * 60 * 1000;
    
    if (timeSinceLastSOS < cooldownMs) {
      const minutesRemaining = Math.ceil((cooldownMs - timeSinceLastSOS) / 60000);
      Alert.alert(
        'Cooldown Active',
        `Please wait ${minutesRemaining} more minute(s) before creating another SOS request.`
      );
      return;
    }

    // Check if user already has an active SOS by querying DB directly
    const allActiveMarkers = await getActiveSOSMarkers();
    const myActiveMarkers = allActiveMarkers.filter((m: any) => m.created_by === deviceId && m.status === 'active');
    
    if (myActiveMarkers.length > 0) {
      Alert.alert(
        'Active SOS Exists',
        'You already have an active SOS request. Please complete it before creating a new one.',
        [
          { text: 'OK', style: 'cancel' },
          {
            text: 'Complete Old SOS',
            style: 'destructive',
            onPress: async () => {
              // Complete the oldest one
              for (const oldMarker of myActiveMarkers) {
                await completeSOSRequest(oldMarker.id);
              }
              await refreshSOS();
              Alert.alert('Done', 'Old SOS request(s) completed. You can now create a new one.');
            }
          }
        ]
      );
      return;
    }

    setIsCreatingSOS(true);

    try {
      const sosId = `sos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await dbCreateSOSMarker({
        id: sosId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        createdBy: deviceId,
        createdAt: Date.now()
      });

      setLastSOSCreatedAt(Date.now());
      
      await refreshSOS();
      
      uiLogger.info('✅ SOS request created:', sosId);
      
      Alert.alert(
        'SOS Sent',
        'Your SOS request has been sent to nearby users. Waiting for responses...'
      );

    } catch (error) {
      uiLogger.error('Error creating SOS request:', error);
      Alert.alert('Error', 'Failed to create SOS request. Please try again.');
    } finally {
      setIsCreatingSOS(false);
    }
  }, [location, deviceId, myActiveSOSRequest, lastSOSCreatedAt]);

  /**
   * Complete an SOS request
   */
  const completeSOSRequest = useCallback(async (sosId: string) => {
    try {
      await dbCompleteSOSMarker(sosId);
      await refreshSOS();
      
      uiLogger.info('✅ SOS request completed:', sosId);
      
      Alert.alert(
        'SOS Completed',
        'Your SOS has been marked as resolved. It will be removed from the map in 5 minutes.'
      );

    } catch (error) {
      uiLogger.error('Error completing SOS request:', error);
      Alert.alert('Error', 'Failed to complete SOS request');
    }
  }, []);

  /**
   * Respond to an SOS request
   */
  const respondToSOS = useCallback(async (sosId: string) => {
    if (!location || !deviceId) {
      Alert.alert('Error', 'Unable to get your current location');
      return;
    }

    try {
      // Check if SOS exists and is active
      const sosMarker = activeSOSMarkers.find(m => m.id === sosId);
      if (!sosMarker || sosMarker.status !== 'active') {
        Alert.alert('Error', 'This SOS request is no longer active');
        return;
      }

      // Check responder limit
      const responses = await getSOSResponses(sosId);
      if (responses.length >= SOS_MAX_RESPONDERS) {
        Alert.alert(
          'Responders Full',
          `This SOS request already has the maximum number of responders (${SOS_MAX_RESPONDERS}).`
        );
        return;
      }

      // Check if already responding
      if (responses.some(r => r.responder_device_id === deviceId)) {
        Alert.alert('Error', 'You are already responding to this SOS');
        return;
      }

      // Check if user already responding to another SOS
      if (myActiveSOSResponse) {
        Alert.alert(
          'Already Responding',
          'You are already responding to another SOS. Cancel that response first.'
        );
        return;
      }

      // Calculate initial distance and ETA
      const distance = getDistance(
        { latitude: location.coords.latitude, longitude: location.coords.longitude },
        { latitude: sosMarker.latitude, longitude: sosMarker.longitude }
      );

      const etaMinutes = Math.ceil(distance / 1.39 / 60);

      // Add response
      await addSOSResponse({
        sosMarkerId: sosId,
        responderDeviceId: deviceId,
        currentLatitude: location.coords.latitude,
        currentLongitude: location.coords.longitude,
        distanceMeters: distance,
        etaMinutes
      });

      await refreshSOS();

      uiLogger.info('✅ Started responding to SOS:', sosId);

    } catch (error) {
      uiLogger.error('Error responding to SOS:', error);
      Alert.alert('Error', 'Failed to respond to SOS request');
    }
  }, [location, deviceId, activeSOSMarkers, myActiveSOSResponse]);

  /**
   * Cancel SOS response
   */
  const cancelSOSResponse = useCallback(async (sosId: string) => {
    if (!deviceId) return;

    try {
      await dbCancelSOSResponse(sosId, deviceId);
      await refreshSOS();
      
      uiLogger.info('✅ Cancelled SOS response:', sosId);

    } catch (error) {
      uiLogger.error('Error cancelling SOS response:', error);
      Alert.alert('Error', 'Failed to cancel response');
    }
  }, [deviceId]);

  /**
   * Get responses for an SOS marker
   */
  const getSOSResponsesForMarker = useCallback(async (sosId: string): Promise<SOSResponse[]> => {
    const responses = await getSOSResponses(sosId);
    return responses.map(r => ({
      id: r.id,
      sosMarkerId: r.sos_marker_id,
      responderDeviceId: r.responder_device_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      currentLatitude: r.current_latitude,
      currentLongitude: r.current_longitude,
      distanceMeters: r.distance_meters,
      etaMinutes: r.eta_minutes,
      status: r.status as 'active' | 'cancelled' | 'arrived',
      syncedToCloud: r.synced_to_cloud === 1
    }));
  }, []);

  /**
   * Handle responder arrival
   */
  const handleArrival = useCallback(async (sosId: string) => {
    uiLogger.info('🎉 Responder arrived at SOS location:', sosId);
    
    Alert.alert(
      'Arrived',
      'You have arrived at the SOS location. The person in need should be nearby.'
    );
  }, []);

  /**
   * Cleanup expired SOS markers
   */
  const cleanupExpiredSOS = useCallback(async () => {
    const now = Date.now();
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
    
    for (const sosMarker of activeSOSMarkers) {
      // Clean up completed markers that have expired
      if (sosMarker.status === 'completed' && sosMarker.expiresAt && sosMarker.expiresAt <= now) {
        uiLogger.info('🗑️ Cleaning up expired completed SOS:', sosMarker.id);
        await deleteSOSMarker(sosMarker.id);
      }
      // Clean up active markers that are more than 24 hours old (stale)
      else if (sosMarker.status === 'active' && sosMarker.createdAt < twentyFourHoursAgo) {
        uiLogger.info('🗑️ Cleaning up stale active SOS:', sosMarker.id);
        await deleteSOSMarker(sosMarker.id);
      }
    }
    
    // Refresh after cleanup
    await refreshSOS();
  }, [activeSOSMarkers]);

  /**
   * Dismiss an SOS notification
   */
  const dismissSOSNotification = useCallback((sosId: string) => {
    uiLogger.info('🔕 User dismissed SOS notification:', sosId.substring(0, 12));
    setDismissedSOSIds(prev => new Set([...prev, sosId]));
  }, []);

  const value: SOSContextType = {
    activeSOSMarkers,
    myActiveSOSRequest,
    myActiveSOSResponse,
    nearbySOSNotifications,
    createSOSRequest,
    completeSOSRequest,
    respondToSOS,
    cancelSOSResponse,
    getSOSResponsesForMarker,
    dismissSOSNotification,
    refreshSOS,
    isCreatingSOS
  };

  return (
    <SOSContext.Provider value={value}>
      {children}
    </SOSContext.Provider>
  );
}

export function useSOS() {
  const context = useContext(SOSContext);
  if (context === undefined) {
    throw new Error('useSOS must be used within SOSProvider');
  }
  return context;
}
