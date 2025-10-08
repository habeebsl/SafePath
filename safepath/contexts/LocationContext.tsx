import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import * as Location from 'expo-location';
import { useLocationTracking } from '@/hooks/useLocationTracking';

interface LocationContextType {
  location: Location.LocationObject | null;
  error: string | null;
  isTracking: boolean;
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

  // Auto-start tracking when app loads
  useEffect(() => {
    locationData.startTracking();
  }, []);

  return (
    <LocationContext.Provider value={locationData}>
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
