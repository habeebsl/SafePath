/**
 * SOS Torch Button Component - Web Version
 * Uses Media Capture API for torch control on mobile web browsers
 * SOS = • • • — — — • • • (3 short, 3 long, 3 short)
 */

import { Alert } from '@/components/Alert';
import { Icon } from '@/components/Icon';
import { uiLogger } from '@/utils/logger';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';

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
  const [hasPermission, setHasPermission] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
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
      // Clean up media stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.remove();
      }
    };
  }, []);

  // Request camera permission and setup torch
  const requestPermissionAndSetup = async (): Promise<boolean> => {
    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        uiLogger.error('getUserMedia not available');
        Alert.alert(
          'Not Supported',
          'Camera access is not supported on this browser. The torch feature requires camera access.',
          [{ text: 'OK' }]
        );
        return false;
      }

      setIsRequesting(true);

      // Request camera with torch capability
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Back camera
          // @ts-ignore - torch is not in TypeScript types yet
          advanced: [{ torch: true }]
        }
      });

      const videoTrack = stream.getVideoTracks()[0];
      // @ts-ignore - torch capability check
      const capabilities = videoTrack.getCapabilities();
      
      // Check if torch is supported
      if (capabilities && 'torch' in capabilities) {
        streamRef.current = stream;
        trackRef.current = videoTrack;
        
        // Create a hidden video element to keep the stream alive
        const video = document.createElement('video');
        video.style.display = 'none';
        video.srcObject = stream;
        video.play();
        videoRef.current = video;
        
        setHasPermission(true);
        uiLogger.info('✅ Torch permission granted and setup complete');
        return true;
      } else {
        // Clean up if torch not supported
        stream.getTracks().forEach(track => track.stop());
        uiLogger.error('Torch not supported on this device');
        Alert.alert(
          'Not Supported',
          'Flashlight is not supported on this device.',
          [{ text: 'OK' }]
        );
        return false;
      }
    } catch (error) {
      uiLogger.error('Permission denied or error:', error);
      Alert.alert(
        'Permission Denied',
        'Camera permission denied. Please allow camera access to use the torch.',
        [{ text: 'OK' }]
      );
      return false;
    } finally {
      setIsRequesting(false);
    }
  };

  // Function to control torch
  const setTorchEnabled = async (enabled: boolean) => {
    if (!trackRef.current) return;

    try {
      // @ts-ignore - torch is not in TypeScript types yet but works on mobile browsers
      await trackRef.current.applyConstraints({
        // @ts-ignore
        advanced: [{ torch: enabled }]
      });
    } catch (error) {
      uiLogger.error('Error controlling torch:', error);
    }
  };

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
    if (isActive && hasPermission) {
      uiLogger.info('🔦 Starting SOS torch pattern (web)');
      runSOSPattern();
    } else {
      if (patternRef.current) {
        clearTimeout(patternRef.current);
        patternRef.current = null;
      }
      setTorchEnabled(false);
      uiLogger.info('🔦 Stopped SOS torch pattern (web)');
    }
  }, [isActive, hasPermission, runSOSPattern]);

  // Handle button press
  const handlePress = async () => {
    // If already active, just stop it
    if (isActive) {
      setIsActive(false);
      return;
    }

    // If no permission yet, request it
    if (!hasPermission) {
      const granted = await requestPermissionAndSetup();
      if (!granted) {
        return; // Permission denied or not supported
      }
    }

    // Start the pattern
    setIsActive(true);
  };

  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const isDesktop = screenWidth >= 768;

  return (
    <>
      {/* Torch Button */}
      <button
        onClick={handlePress}
        style={{
          width: isDesktop ? '50px' : '44px',
          height: isDesktop ? '50px' : '44px',
          borderRadius: isDesktop ? '25px' : '22px',
          backgroundColor: isActive ? '#FFA500' : '#FFFFFF',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0px 2px 4px 0px rgba(0, 0, 0, 0.25)',
          cursor: 'pointer',
        }}
        aria-label={isActive ? "Stop SOS torch" : "Start SOS torch"}
      >
        <Icon 
          name="lightbulb" 
          size={isDesktop ? 18 : 16} 
          color={isActive ? "#FFFFFF" : "#FFA500"} 
          library="fa5"
        />
      </button>

      {/* Torch Status Text */}
      <div
        style={{
          paddingLeft: isDesktop ? '12px' : '10px',
          paddingRight: isDesktop ? '12px' : '10px',
          paddingTop: isDesktop ? '6px' : '4px',
          paddingBottom: isDesktop ? '6px' : '4px',
          borderRadius: isDesktop ? '14px' : '12px',
          backgroundColor: isActive ? 'rgba(255, 165, 0, 0.95)' : 'rgba(158, 158, 158, 0.95)',
        }}
      >
        <Text
          style={{
            color: '#fff',
            fontSize: isDesktop ? 13 : 11,
            fontWeight: isDesktop ? '700' : '600',
          }}
        >
          {isActive ? 'Torch Active' : 'SOS Torch'}
        </Text>
      </div>
    </>
  );
}
