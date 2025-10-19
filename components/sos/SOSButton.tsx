/**
 * SOS Button Component
 * Floating button on map to send SOS requests
 */

import { Alert } from '@/components/Alert';
import { Icon } from '@/components/Icon';
import { useSOS } from '@/contexts/SOSContext';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

export function SOSButton() {
  const { createSOSRequest, myActiveSOSRequest, isCreatingSOS } = useSOS();

  const handlePress = () => {
    // Haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

    // Show confirmation dialog
    Alert.alert(
      'Send SOS?',
      'This will alert nearby users that you need help. Only use in real emergencies.',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Send SOS',
          style: 'destructive',
          onPress: async () => {
            await createSOSRequest();
          }
        }
      ]
    );
  };

  // Disabled if already has active SOS
  const isDisabled = !!myActiveSOSRequest || isCreatingSOS;

  return (
    <TouchableOpacity
      style={[styles.button, isDisabled && styles.buttonDisabled]}
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityLabel="Send SOS"
      accessibilityHint="Alert nearby users that you need help"
    >
      <View style={styles.content}>
        {isCreatingSOS ? (
          <ActivityIndicator size="small" color="#FF0000" />
        ) : (
          <Icon name="phone" size={24} color="#FF0000" library="fa5" />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 200, // Middle of button stack
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
  buttonDisabled: {
    backgroundColor: '#999',
    opacity: 0.6,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
