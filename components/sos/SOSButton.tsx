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
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Icon name="phone" size={24} color="#fff" library="fa5" />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 270, // Above recenter button (which is at 100px)
    right: 10,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF0000',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0px 3px 5px 0px rgba(0, 0, 0, 0.3)',
    elevation: 8,
    borderWidth: 3,
    borderColor: '#fff',
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
