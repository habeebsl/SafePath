import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';

interface UseLocationTrackingOptions {
  accuracy?: Location.LocationAccuracy;
  distanceInterval?: number; // meters
  timeInterval?: number; // milliseconds
}

export function useLocationTracking(options: UseLocationTrackingOptions = {}) {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [subscription, setSubscription] = useState<Location.LocationSubscription | null>(null);

  // Start tracking
  const startTracking = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setError('Permission denied');
        return;
      }

      const sub = await Location.watchPositionAsync(
        {
          accuracy: options.accuracy || Location.Accuracy.High,
          distanceInterval: options.distanceInterval || 10,
          timeInterval: options.timeInterval || 5000,
        },
        (newLocation) => {
          setLocation(newLocation);
          setError(null);
        }
      );

      setSubscription(sub);
      setIsTracking(true);
    } catch (err) {
      setError('Failed to start tracking');
    }
  }, [options]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (subscription) {
      subscription.remove();
      setSubscription(null);
      setIsTracking(false);
    }
  }, [subscription]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, [subscription]);

  return {
    location,
    error,
    isTracking,
    startTracking,
    stopTracking,
  };
}