/**
 * Custom Alert Component for Web
 * Provides a native-like alert dialog that matches React Native's Alert API
 */

import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { uiLogger } from '@/utils/logger';

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface AlertState {
  visible: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
}

let alertController: {
  show: (title: string, message?: string, buttons?: AlertButton[]) => void;
} | null = null;

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alertState, setAlertState] = useState<AlertState>({
    visible: false,
    title: '',
    message: '',
    buttons: []
  });

  // Register the controller on mount
  React.useEffect(() => {
    uiLogger.info('🚀 AlertProvider mounted, registering controller');
    alertController = {
      show: (title: string, message?: string, buttons?: AlertButton[]) => {
        uiLogger.info('📢 Alert controller.show called:', { title, message, buttons });
        setAlertState({
          visible: true,
          title,
          message,
          buttons: buttons || [{ text: 'OK', style: 'default' }]
        });
      }
    };

    return () => {
      uiLogger.info('👋 AlertProvider unmounting, clearing controller');
      alertController = null;
    };
  }, []);

  const handleButtonPress = (button: AlertButton) => {
    setAlertState(prev => ({ ...prev, visible: false }));
    if (button.onPress) {
      // Small delay to allow modal to close smoothly
      setTimeout(() => button.onPress!(), 100);
    }
  };

  // Render alert using portal to document.body for highest z-index
  const alertElement = alertState.visible && (
    <View style={styles.overlay}>
      <View style={styles.alertBox}>
        {/* Title */}
        <Text style={styles.title}>{alertState.title}</Text>
        
        {/* Message */}
        {alertState.message && (
          <Text style={styles.message}>{alertState.message}</Text>
        )}
        
        {/* Buttons */}
        <View style={styles.buttonContainer}>
          {alertState.buttons.map((button, index) => (
            <TouchableOpacity
              key={index}
              style={[
                styles.button,
                button.style === 'cancel' && styles.buttonCancel,
                button.style === 'destructive' && styles.buttonDestructive,
                index > 0 && styles.buttonBorder
              ]}
              onPress={() => handleButtonPress(button)}
            >
              <Text
                style={[
                  styles.buttonText,
                  button.style === 'cancel' && styles.buttonTextCancel,
                  button.style === 'destructive' && styles.buttonTextDestructive
                ]}
              >
                {button.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <>
      {children}
      {typeof document !== 'undefined' && alertElement && ReactDOM.createPortal(alertElement, document.body)}
    </>
  );
}

// Custom Alert API that matches React Native's Alert.alert()
export const Alert = {
  alert: (
    title: string,
    message?: string,
    buttons?: AlertButton[]
  ) => {
    if (alertController) {
      alertController.show(title, message, buttons);
    } else {
      uiLogger.warn('⚠️ AlertProvider not mounted. Using native alert as fallback.');
      window.alert(`${title}\n\n${message || ''}`);
    }
  }
};

const styles = StyleSheet.create({
  overlay: {
    position: 'fixed' as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 9999999, // Ultra-high z-index to render above all modals (10x higher than standard Modal z-index)
  },
  alertBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    minWidth: 270,
    maxWidth: 400,
    width: '100%',
    boxShadow: '0px 4px 8px 0px rgba(0, 0, 0, 0.3)',
    elevation: 10,
    overflow: 'hidden',
    zIndex: 10000000, // Even higher to ensure the box is above the overlay
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 8,
    color: '#000',
  },
  message: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    color: '#000',
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0, 0, 0, 0.2)',
  },
  button: {
    flex: 1,
    paddingVertical: 11,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  buttonBorder: {
    borderLeftWidth: 0.5,
    borderLeftColor: 'rgba(0, 0, 0, 0.2)',
  },
  buttonCancel: {
    // Cancel buttons appear bolder on iOS
  },
  buttonDestructive: {
    // Destructive styling
  },
  buttonText: {
    fontSize: 17,
    color: '#007AFF',
    fontWeight: '400',
  },
  buttonTextCancel: {
    fontWeight: '600',
  },
  buttonTextDestructive: {
    color: '#FF3B30',
    fontWeight: '400',
  },
});
