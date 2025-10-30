/**
 * Toast Notification Component
 * Reusable toast for showing brief notifications
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Icon } from './Icon';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onHide?: () => void;
  devMode?: boolean;
}

export function Toast({ visible, message, type = 'info', duration = 3000, onHide, devMode = false }: ToastProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (devMode) {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      return;
    }
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        hideToast();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, devMode]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide?.();
    });
  };

  if (!devMode && !visible) return null;

  // Choose background and text/icon color based on type for best contrast
  let bgColor = '#2563eb'; // blue
  let textColor = '#fff';
  let iconColor = '#fff';
  let icon = 'info-circle';
  switch (type) {
    case 'success':
      bgColor = '#22c55e'; // green
      textColor = '#fff';
      iconColor = '#fff';
      icon = 'check-circle';
      break;
    case 'error':
      bgColor = '#ef4444'; // red
      textColor = '#fff';
      iconColor = '#fff';
      icon = 'exclamation-circle';
      break;
    case 'warning':
      bgColor = '#f59e0b'; // yellow
      textColor = '#222';
      iconColor = '#222';
      icon = 'exclamation-triangle';
      break;
    case 'info':
    default:
      bgColor = '#2563eb'; // blue
      textColor = '#fff';
      iconColor = '#fff';
      icon = 'info-circle';
      break;
  }

  // Exit button handler
  const handleExit = () => {
    hideToast();
  };

  // Calculate responsive width for larger screens
  const screenWidth = Dimensions.get('window').width;
  const isLargeScreen = screenWidth >= 768; // tablet/desktop breakpoint
  const toastWidth = isLargeScreen ? 500 : Math.min(screenWidth - 40, 380);
  const toastLeft = (screenWidth - toastWidth) / 2; // Center horizontally

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          backgroundColor: bgColor,
          borderWidth: 0, // Remove border
          width: toastWidth,
          left: toastLeft,
          right: 'auto', // Override right constraint
        },
      ]}
    >
      <Icon name={icon} size={22} color={iconColor} style={styles.icon} />
      <Text style={[styles.message, { color: textColor }]} numberOfLines={2}>
        {devMode ? 'Toast Preview' : message}
      </Text>
      <TouchableOpacity onPress={handleExit} accessibilityLabel="Close notification">
        <Icon
          name="times"
          size={22}
          color={iconColor}
          style={styles.exit}
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 80,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
    zIndex: 999999,
    minHeight: 56,
  },
  icon: {
    marginRight: 14,
    marginLeft: 2,
  },
  message: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
    marginRight: 8,
  },
  exit: {
    marginLeft: 10,
    padding: 4,
    opacity: 0.7,
  },
});
