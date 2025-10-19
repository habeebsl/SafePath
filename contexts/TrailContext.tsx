/**
 * Trail Context for SafePath
 * 
 * Manages navigation trail state across the app
 */

import { Alert } from '@/components/Alert';
import { Marker } from '@/types/marker';
import {
  ARRIVAL_THRESHOLD,
  Trail,
  TRAIL_PRIORITIES,
  TRAIL_STYLES,
  TrailContext as TrailContextType
} from '@/types/trail';
import { uiLogger } from '@/utils/logger';
import {
  calculateProgress,
  calculateRoute,
  formatDistance,
  getRemainingDistance,
  RoutingStrategy
} from '@/utils/routing';
import NetInfo from '@react-native-community/netinfo';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLocation } from './LocationContext';

interface TrailContextValue {
  activeTrail: Trail | null;
  isLoading: boolean;
  createTrail: (marker: Marker, context: TrailContextType) => Promise<void>;
  cancelTrail: () => void;
}

const TrailContext = createContext<TrailContextValue | undefined>(undefined);

export function TrailProvider({ children }: { children: React.ReactNode }) {
  const [activeTrail, setActiveTrail] = useState<Trail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  
  const { location } = useLocation();
  
  // Monitor network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
    });
    
    return () => unsubscribe();
  }, []);
  
  // Update trail progress as user moves
  useEffect(() => {
    if (!activeTrail || !location) return;
    
    const currentLocation = {
      lat: location.coords.latitude,
      lon: location.coords.longitude
    };
    
    const remainingDistance = getRemainingDistance(
      currentLocation,
      activeTrail.route.waypoints
    );
    
    const progress = calculateProgress(
      currentLocation,
      activeTrail.route.waypoints
    );
    
    const etaMinutes = Math.ceil(remainingDistance / 1.39 / 60); // Walking speed 5km/h
    
    // Only update if values have actually changed (prevent infinite loop)
    if (
      activeTrail.distanceRemaining !== remainingDistance ||
      activeTrail.currentProgress !== progress ||
      activeTrail.etaMinutes !== etaMinutes
    ) {
      setActiveTrail(prev => prev ? {
        ...prev,
        distanceRemaining: remainingDistance,
        currentProgress: progress,
        etaMinutes
      } : null);
    }
    
    // Check if user arrived at destination
    if (remainingDistance <= ARRIVAL_THRESHOLD) {
      handleArrival();
    }
  }, [location]); // Only depend on location, not activeTrail
  
  const createTrail = useCallback(async (
    marker: Marker,
    context: TrailContextType
  ) => {
    if (!location) {
      Alert.alert('Location Required', 'Unable to get your current location');
      return;
    }
    
    const currentLocation = {
      lat: location.coords.latitude,
      lon: location.coords.longitude
    };
    
    const destination = {
      lat: marker.latitude,
      lon: marker.longitude
    };
    
    // Check if replacing existing trail
    if (activeTrail) {
      const shouldReplace = await confirmReplaceTrail(activeTrail, marker, context);
      if (!shouldReplace) return;
    }
    
    setIsLoading(true);
    
    try {
      uiLogger.info('🗺️ Creating trail to:', marker.title);
      
      // Calculate route (online, cached, or offline)
      const route = await calculateRoute(currentLocation, destination, {
        isOnline,
        dangerZones: [] // TODO: Pass danger zones from database
      });
      
      uiLogger.info('✅ Route calculated:', route.strategy);
      uiLogger.info('📏 Distance:', route.distance, 'meters');
      uiLogger.info('⏱️ Duration:', route.duration, 'seconds');
      uiLogger.info('📍 Waypoints:', route.waypoints.length);
      
      // Show routing strategy to user
      if (route.strategy === RoutingStrategy.CACHED) {
        Alert.alert(
          '💾 Using Cached Route',
          'Showing previously calculated route. May not reflect recent changes.',
          [{ text: 'OK' }]
        );
      } else if (route.strategy === RoutingStrategy.OFFLINE_SIMPLE) {
        Alert.alert(
          '📍 Offline Route',
          'Showing basic route. Actual path may differ. Route will improve when back online.',
          [{ text: 'OK' }]
        );
      }
      
      // Create trail
      const trail: Trail = {
        id: `trail_${Date.now()}`,
        from: currentLocation,
        to: destination,
        route,
        context,
        targetMarker: marker,
        color: getTrailColor(marker.type, context),
        isActive: true,
        createdAt: new Date().toISOString(),
        currentProgress: 0,
        distanceRemaining: route.distance,
        etaMinutes: Math.ceil(route.duration / 60),
        startedAt: new Date().toISOString()
      };
      
      setActiveTrail(trail);
      uiLogger.info('✅ Trail created successfully');
      
    } catch (error) {
      uiLogger.error('❌ Failed to create trail:', error);
      Alert.alert(
        'Route Error',
        'Unable to calculate route. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  }, [location, activeTrail, isOnline]);
  
  const cancelTrail = useCallback(() => {
    if (!activeTrail) return;
    
    uiLogger.info('🚫 Canceling trail');
    setActiveTrail(null);
  }, [activeTrail]);
  
  const handleArrival = useCallback(() => {
    if (!activeTrail) return;
    
    uiLogger.info('🎉 User arrived at destination!');
    
    Alert.alert(
      '✅ You have Arrived!',
      `You reached ${activeTrail.targetMarker.title}`,
      [{ text: 'OK', onPress: () => setActiveTrail(null) }]
    );
  }, [activeTrail]);
  
  const confirmReplaceTrail = async (
    currentTrail: Trail,
    newMarker: Marker,
    newContext: TrailContextType
  ): Promise<boolean> => {
    const currentPriority = TRAIL_PRIORITIES[currentTrail.context];
    const newPriority = TRAIL_PRIORITIES[newContext];
    
    // Higher priority trail? Auto-replace with notice
    if (newPriority.level > currentPriority.level) {
      Alert.alert(
        '🚨 Priority Route',
        `Switching to ${TRAIL_STYLES[newContext].label}`,
        [{ text: 'OK' }]
      );
      return true;
    }
    
    // Need confirmation?
    if (currentPriority.requiresConfirmation) {
      return new Promise((resolve) => {
        const warning = currentPriority.abandonmentWarning;
        
        Alert.alert(
          'Replace Current Trail?',
          `You're currently navigating to:\n${currentTrail.targetMarker.title} (${formatDistance(currentTrail.distanceRemaining)})\n\n` +
          `Replace with trail to:\n${newMarker.title}?\n\n` +
          (warning ? `⚠️ ${warning}` : ''),
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => resolve(false)
            },
            {
              text: 'Replace',
              style: 'destructive',
              onPress: () => resolve(true)
            }
          ]
        );
      });
    }
    
    // No confirmation needed
    return true;
  };
  
  const getTrailColor = (markerType: string, context: TrailContextType): string => {
    // Import marker config to get marker color
    const { getMarkerConfig } = require('@/constants/marker-icons');
    const markerConfig = getMarkerConfig(markerType);
    
    // Use marker color instead of context color for better visual consistency
    return markerConfig.color;
  };
  
  const value: TrailContextValue = {
    activeTrail,
    isLoading,
    createTrail,
    cancelTrail
  };
  
  return (
    <TrailContext.Provider value={value}>
      {children}
    </TrailContext.Provider>
  );
}

export function useTrail() {
  const context = useContext(TrailContext);
  if (context === undefined) {
    throw new Error('useTrail must be used within a TrailProvider');
  }
  return context;
}
