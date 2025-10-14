import { uiLogger } from '@/utils/logger';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';

export type LocationTrackingStatus = 
  | 'tracking'           // Actively tracking location
  | 'permission-denied'  // User denied location permissions
  | 'location-disabled'  // Location services are turned off on device
  | 'error'             // Other error occurred
  | 'stopped';          // User stopped tracking manually

interface UseLocationTrackingOptions {
  accuracy?: Location.LocationAccuracy;
  distanceInterval?: number; // meters
  timeInterval?: number; // milliseconds
}

/**
 * Open device location settings
 * Android: Opens location settings directly
 * iOS: Opens app-specific settings
 */
const openLocationSettings = async () => {
  try {
    if (Platform.OS === 'android') {
      // Android: Go directly to device location settings
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS
      );
    } else {
      // iOS: Open app settings (includes location permission toggle)
      await Linking.openSettings();
    }
  } catch (err) {
    uiLogger.error('Failed to open settings:', err);
    Alert.alert('Error', 'Unable to open settings. Please open settings manually.');
  }
};

export function useLocationTracking(options: UseLocationTrackingOptions = {}) {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState<LocationTrackingStatus>('stopped');
  const [subscription, setSubscription] = useState<Location.LocationSubscription | null>(null);

  // Check location service status
  const checkLocationStatus = useCallback(async () => {
    try {
      // Check if location services are enabled on device
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        uiLogger.warn('📍 Location services are disabled on device');
        setTrackingStatus('location-disabled');
        setError('Location services are turned off');
        return false;
      }

      // Check permissions
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        uiLogger.warn('📍 Location permission not granted:', status);
        setTrackingStatus('permission-denied');
        setError('Location permission denied');
        return false;
      }

      return true;
    } catch (err) {
      uiLogger.error('📍 Error checking location status:', err);
      setTrackingStatus('error');
      setError('Failed to check location status');
      return false;
    }
  }, []);

  // Start tracking
  const startTracking = useCallback(async () => {
    try {
      uiLogger.info('📍 Starting location tracking...');
      
      // First, check if location services are enabled on the device
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        uiLogger.warn('📍 Location services disabled on device');
        setError('Location services are turned off');
        setTrackingStatus('location-disabled');
        setIsTracking(false);
        
        // Show alert with option to open settings
        Alert.alert(
          'Location Services Off',
          Platform.OS === 'android' 
            ? 'Please enable location services on your device to track your position.'
            : 'Please enable location services in Settings to track your position.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings', 
              onPress: openLocationSettings
            }
          ]
        );
        return;
      }

      // Check current permission status
      const { status: currentStatus, canAskAgain } = await Location.getForegroundPermissionsAsync();
      
      // If permission already granted, start tracking
      if (currentStatus === 'granted') {
        await startLocationWatch();
        return;
      }

      // If we can ask for permission, request it (shows system dialog)
      if (canAskAgain) {
        uiLogger.info('📍 Requesting location permission...');
        const { status } = await Location.requestForegroundPermissionsAsync();
        
        if (status === 'granted') {
          await startLocationWatch();
          return;
        } else {
          // User denied permission
          uiLogger.warn('📍 Location permission denied');
          setError('Permission denied');
          setTrackingStatus('permission-denied');
          setIsTracking(false);
          return;
        }
      }

      // Permission permanently denied (can't ask again)
      uiLogger.warn('📍 Location permission permanently denied');
      setError('Permission denied');
      setTrackingStatus('permission-denied');
      setIsTracking(false);
      
      // Show alert guiding to settings
      Alert.alert(
        'Location Permission Required',
        'This app needs location access to track your position. Please grant location permission in settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Open Settings', 
            onPress: openLocationSettings
          }
        ]
      );
    } catch (err) {
      uiLogger.error('❌ Failed to start tracking:', err);
      setError('Failed to start tracking');
      setTrackingStatus('error');
      setIsTracking(false);
    }
  }, [options]);

  // Helper function to start the actual location watch
  const startLocationWatch = async () => {
    try {
      const sub = await Location.watchPositionAsync(
        {
          accuracy: options.accuracy || Location.Accuracy.High,
          distanceInterval: options.distanceInterval || 10,
          timeInterval: options.timeInterval || 5000,
        },
        (newLocation) => {
          setLocation(newLocation);
          setError(null);
          setTrackingStatus('tracking');
          uiLogger.debug('📍 Location updated:', newLocation.coords.latitude, newLocation.coords.longitude);
        }
      );

      setSubscription(sub);
      setIsTracking(true);
      setTrackingStatus('tracking');
      uiLogger.info('✅ Location tracking started');
    } catch (err) {
      uiLogger.error('❌ Failed to watch position:', err);
      setError('Failed to start location watch');
      setTrackingStatus('error');
      setIsTracking(false);
    }
  };

  // Stop tracking
  const stopTracking = useCallback(() => {
    uiLogger.info('🛑 Stopping location tracking');
    if (subscription) {
      subscription.remove();
      setSubscription(null);
    }
    setIsTracking(false);
    setTrackingStatus('stopped');
  }, [subscription]);

  // Monitor location service status periodically
  useEffect(() => {
    if (!isTracking) return;

    let hasShownAlert = false; // Prevent multiple alerts

    const interval = setInterval(async () => {
      try {
        // Check if location services are still enabled
        const isEnabled = await Location.hasServicesEnabledAsync();
        if (!isEnabled) {
          if (subscription) {
            uiLogger.warn('📍 Location services disabled during tracking');
            subscription.remove();
            setSubscription(null);
            setIsTracking(false);
            setTrackingStatus('location-disabled');
            setError('Location services turned off');
          }

          // Show alert once
          if (!hasShownAlert) {
            hasShownAlert = true;
            Alert.alert(
              'Location Services Disabled',
              'Location tracking has stopped because location services were turned off.',
              [
                { text: 'OK', style: 'cancel' },
                { 
                  text: 'Enable Location', 
                  onPress: openLocationSettings
                }
              ]
            );
          }
          return;
        }

        // Check if permission is still granted
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (subscription) {
            uiLogger.warn('📍 Location permission revoked during tracking');
            subscription.remove();
            setSubscription(null);
            setIsTracking(false);
            setTrackingStatus('permission-denied');
            setError('Location permission revoked');
          }

          // Show alert once
          if (!hasShownAlert) {
            hasShownAlert = true;
            Alert.alert(
              'Location Permission Revoked',
              'Location tracking has stopped because location permission was revoked.',
              [
                { text: 'OK', style: 'cancel' },
                { 
                  text: 'Grant Permission', 
                  onPress: openLocationSettings
                }
              ]
            );
          }
          return;
        }
      } catch (err) {
        uiLogger.error('📍 Error monitoring location status:', err);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [isTracking, subscription, checkLocationStatus]);

  // Monitor app state changes (when user returns from Settings)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      // When app comes to foreground, check location status
      if (nextAppState === 'active') {
        uiLogger.info('📱 App became active, checking location status...');
        
        try {
          const isEnabled = await Location.hasServicesEnabledAsync();
          const { status } = await Location.getForegroundPermissionsAsync();
          
          // If location was disabled but now enabled, and we're not tracking, update status
          if (trackingStatus === 'location-disabled' && isEnabled) {
            if (status === 'granted') {
              uiLogger.info('✅ Location services re-enabled');
              setTrackingStatus('stopped');
              setError(null);
            } else {
              // Location enabled but permission not granted
              setTrackingStatus('permission-denied');
              setError('Location permission denied');
            }
          }
          
          // If permission was denied but now granted, and we're not tracking, update status
          if (trackingStatus === 'permission-denied' && status === 'granted') {
            if (isEnabled) {
              uiLogger.info('✅ Location permission granted');
              setTrackingStatus('stopped');
              setError(null);
            } else {
              // Permission granted but location disabled
              setTrackingStatus('location-disabled');
              setError('Location services are turned off');
            }
          }

          // If everything is good and user previously had issues, automatically restart tracking
          if ((trackingStatus === 'location-disabled' || trackingStatus === 'permission-denied') && 
              isEnabled && status === 'granted' && !isTracking) {
            uiLogger.info('🔄 Auto-restarting tracking after issue resolved');
            await startTracking();
          }
        } catch (err) {
          uiLogger.error('Error checking status on app resume:', err);
        }
      }
    });

    return () => subscription.remove();
  }, [trackingStatus, isTracking, startTracking]);

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
    trackingStatus,
    startTracking,
    stopTracking,
  };
}