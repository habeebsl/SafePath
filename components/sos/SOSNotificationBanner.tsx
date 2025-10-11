/**
 * SOS Notification Banner
 * Shows proximity alerts for nearby SOS requests
 */

import { Icon } from '@/components/Icon';
import { useSOS } from '@/contexts/SOSContext';
import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SOSDetailsModal } from './SOSDetailsModal';

export function SOSNotificationBanner() {
  const { nearbySOSNotifications, dismissSOSNotification } = useSOS();
  const [visible, setVisible] = useState(false);
  const [selectedSOS, setSelectedSOS] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const slideAnim = useState(new Animated.Value(-100))[0];

  const currentNotification = nearbySOSNotifications[0]; // Show first nearby SOS

  useEffect(() => {
    if (currentNotification && !visible) {
      // Show banner
      setVisible(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();

      // Auto-dismiss after 30 seconds
      const timeout = setTimeout(() => {
        handleDismiss();
      }, 30000);

      return () => clearTimeout(timeout);
    } else if (!currentNotification && visible) {
      // Hide banner
      handleDismiss();
    }
  }, [currentNotification]);

  const handleDismiss = () => {
    // Mark this SOS as dismissed so it doesn't come back
    if (currentNotification) {
      dismissSOSNotification(currentNotification.sosMarker.id);
    }
    
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
    });
  };

  const handleHelp = () => {
    if (currentNotification) {
      setSelectedSOS(currentNotification.sosMarker);
      setShowModal(true);
    }
  };

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  if (!visible || !currentNotification) return null;

  return (
    <>
      <Animated.View
        style={[
          styles.banner,
          {
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Icon name="exclamation-triangle" size={24} color="#FF0000" library="fa5" />
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.title}>Someone Needs Help!</Text>
            <Text style={styles.subtitle}>
              {formatDistance(currentNotification.distance)} away • {currentNotification.respondersCount}/5 responding
            </Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.dismissButton} onPress={handleDismiss}>
              <Text style={styles.dismissText}>Dismiss</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.helpButton} onPress={handleHelp}>
              <Text style={styles.helpText}>Help</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* Modal */}
      <SOSDetailsModal
        visible={showModal}
        sosMarker={selectedSOS}
        onClose={() => {
          setShowModal(false);
          setSelectedSOS(null);
          handleDismiss();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 60,
    left: 10,
    right: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
    zIndex: 1000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFE5E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  dismissButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#E5E5E5',
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  helpButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#FF0000',
  },
  helpText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
