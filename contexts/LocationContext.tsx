import { LocationTrackingStatus, useLocationTracking } from '@/hooks/useLocationTracking';
import { uiLogger } from '@/utils/logger';
import { getCountryFromCoordinates } from '@/utils/region-helpers';
import * as Location from 'expo-location';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface LocationContextType {
  location: Location.LocationObject | null;
  error: string | null;
  isTracking: boolean;
  trackingStatus: LocationTrackingStatus;
  currentCountry: string | null;
  isLocating: boolean;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

interface LocationProviderProps {
  children: ReactNode;
}

export function LocationProvider({ children }: LocationProviderProps) {
  const locationData = useLocationTracking({
    accuracy: Location.Accuracy.High,
    distanceInterval: 10,
    timeInterval: 5000,
  });

  const [currentCountry, setCurrentCountry] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(true);

  // Auto-start tracking when app loads
  useEffect(() => {
    locationData.startTracking();
  }, []);

  // Detect country when location changes
  useEffect(() => {
    if (locationData.location) {
      const { latitude, longitude } = locationData.location.coords;
      uiLogger.info('📍 Location detected:', latitude, longitude);
      
      getCountryFromCoordinates(latitude, longitude).then(country => {
        uiLogger.info('🌍 Country detected:', country || 'Unknown');
        setCurrentCountry(country);
        setIsLocating(false);
      });
    } else {
      uiLogger.info('⏳ Waiting for location...');
    }
  }, [locationData.location]);

  return (
    <LocationContext.Provider value={{
      location: locationData.location,
      error: locationData.error,
      isTracking: locationData.isTracking,
      trackingStatus: locationData.trackingStatus,
      startTracking: locationData.startTracking,
      stopTracking: locationData.stopTracking,
      currentCountry,
      isLocating,
    }}>
      {children}
    </LocationContext.Provider>
  );
}

// Custom hook to use location context
export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}
