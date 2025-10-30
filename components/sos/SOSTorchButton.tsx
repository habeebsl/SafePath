/**
 * SOS Torch Button Component
 * Flashes the device's torch/flashlight in SOS Morse code pattern
 * SOS = • • • — — — • • • (3 short, 3 long, 3 short)
 */

import { Icon } from '@/components/Icon';
import { uiLogger } from '@/utils/logger';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

// SOS Morse code timing (in milliseconds)
const TIMINGS = {
  SHORT_FLASH: 200,    // Dot duration
  LONG_FLASH: 600,     // Dash duration
  GAP_BETWEEN: 200,    // Gap between dots/dashes
  GAP_LETTER: 600,     // Gap between letters (S-O-S)
  GAP_REPEAT: 2000,    // Gap before repeating pattern
};

export function SOSTorchButton() {
  const [isActive, setIsActive] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const isMountedRef = useRef(true);
  const isActiveRef = useRef(false);
  const patternRef = useRef<NodeJS.Timeout | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (patternRef.current) {
        clearTimeout(patternRef.current);
      }
      setTorchEnabled(false);
    };
  }, []);

  // Function to flash the torch with controlled timing
  const flashTorch = async (duration: number): Promise<void> => {
    if (!isMountedRef.current) return;
    
    return new Promise((resolve) => {
      setTorchEnabled(true);
      setTimeout(() => {
        if (isMountedRef.current) {
          setTorchEnabled(false);
        }
        resolve();
      }, duration);
    });
  };

  // Function to create delay
  const wait = (duration: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, duration));
  };

  // Complete SOS pattern function - runs continuously until manually stopped
  const runSOSPattern = useCallback(async () => {
    if (!isMountedRef.current || !isActiveRef.current) return;

    try {
      // S - 3 short flashes
      for (let i = 0; i < 3; i++) {
        if (!isMountedRef.current || !isActiveRef.current) return;
        await flashTorch(TIMINGS.SHORT_FLASH);
        await wait(TIMINGS.GAP_BETWEEN);
      }

      // Gap between letters
      await wait(TIMINGS.GAP_LETTER);
      if (!isMountedRef.current || !isActiveRef.current) return;

      // O - 3 long flashes
      for (let i = 0; i < 3; i++) {
        if (!isMountedRef.current || !isActiveRef.current) return;
        await flashTorch(TIMINGS.LONG_FLASH);
        await wait(TIMINGS.GAP_BETWEEN);
      }

      // Gap between letters
      await wait(TIMINGS.GAP_LETTER);
      if (!isMountedRef.current || !isActiveRef.current) return;

      // S - 3 short flashes
      for (let i = 0; i < 3; i++) {
        if (!isMountedRef.current || !isActiveRef.current) return;
        await flashTorch(TIMINGS.SHORT_FLASH);
        await wait(TIMINGS.GAP_BETWEEN);
      }

      // Gap before repeat
      await wait(TIMINGS.GAP_REPEAT);
      
      // Continue pattern indefinitely until user manually stops
      if (isMountedRef.current && isActiveRef.current) {
        patternRef.current = setTimeout(() => runSOSPattern(), 0) as unknown as NodeJS.Timeout;
      }
    } catch (error) {
      uiLogger.error('Error running SOS pattern:', error);
    }
  }, []);

  // Effect to start/stop pattern when isActive changes
  useEffect(() => {
    if (isActive) {
      uiLogger.info('🔦 Starting SOS torch pattern');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      runSOSPattern();
    } else {
      if (patternRef.current) {
        clearTimeout(patternRef.current);
        patternRef.current = null;
      }
      setTorchEnabled(false);
      uiLogger.info('🔦 Stopped SOS torch pattern');
      if (isMountedRef.current) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  }, [isActive]);

  // Handle button press
  const handlePress = async () => {
    if (!permission?.granted) {
      await requestPermission();
      return;
    }
    
    setIsActive(!isActive);
  };

  // Don't render on web or if permission denied permanently
  if (Platform.OS === 'web' || permission?.granted === false && permission?.canAskAgain === false) {
    return null;
  }

  // Show loading while checking permission
  if (!permission) {
    return (
      <View style={styles.button}>
        <ActivityIndicator size="small" color="#FFA500" />
      </View>
    );
  }

  return (
    <>
      {/* Hidden camera view to control torch */}
      {permission?.granted && (
        <CameraView 
          style={{ width: 0, height: 0 }}
          enableTorch={torchEnabled}
        />
      )}
      
      <TouchableOpacity
        style={[
          styles.button,
          isActive && styles.buttonActive
        ]}
        onPress={handlePress}
        accessibilityLabel={isActive ? "Stop SOS torch" : "Start SOS torch"}
        accessibilityHint="Flashes device torch in SOS pattern"
      >
        <View style={styles.content}>
          <Icon 
            name="lightbulb" 
            size={24} 
            color={isActive ? "#FFFFFF" : "#FFA500"} 
            library="fa5"
          />
        </View>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 120, // Below SOS button in the stack
    right: 10,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 2px 4px 0px rgba(0, 0, 0, 0.25)',
    elevation: 5,
    zIndex: 1000,
  },
  buttonActive: {
    backgroundColor: '#FFA500', // Orange when active
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
