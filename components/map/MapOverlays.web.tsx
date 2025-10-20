/**
 * Map UI overlays - badges, status indicators, and buttons (Web version)
 * Responsive design that adapts to different screen sizes
 */

import { Alert } from '@/components/Alert';
import { Icon } from '@/components/Icon';
import { useSOS } from '@/contexts/SOSContext';
import { LocationTrackingStatus } from '@/hooks/useLocationTracking';
import { Trail } from '@/types/trail';
import { uiLogger } from '@/utils/logger';
import { getLocationDisplayText } from '@/utils/region-helpers';
import * as Haptics from 'expo-haptics';
import { LocationObject } from 'expo-location';
import React from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface MapOverlaysProps {
  isTracking: boolean;
  trackingStatus: LocationTrackingStatus;
  dbReady: boolean;
  location: LocationObject | null;
  isOnline: boolean;
  refreshing: boolean;
  onSync: () => void;
  activeTrail?: Trail | null;
  currentCountry: string | null;
  isLocating: boolean;
}

export function MapOverlays({
  isTracking,
  trackingStatus,
  dbReady,
  location,
  isOnline,
  refreshing,
  onSync,
  activeTrail,
  currentCountry,
  isLocating,
}: MapOverlaysProps) {
  uiLogger.info('🌐 MapOverlays.web.tsx rendering - location:', !!location, 'activeTrail:', !!activeTrail);
  uiLogger.info('🏷️ Region badge - currentCountry:', currentCountry, 'isLocating:', isLocating);
  
  const { createSOSRequest, myActiveSOSRequest, isCreatingSOS } = useSOS();
  
  const screenWidth = Dimensions.get('window').width;
  const isSmallScreen = screenWidth < 600;
  const isDesktop = screenWidth >= 768;
  const regionText = getLocationDisplayText(currentCountry, isLocating);
  uiLogger.info('📝 Region text:', regionText);

  const handleSOSPress = () => {
    // Haptic feedback
    if (Haptics.notificationAsync) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

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

  const isSOSDisabled = !!myActiveSOSRequest || isCreatingSOS;
  
  return (
    <>
      {/* Region badge */}
      <View style={[styles.regionBadge, isDesktop && styles.regionBadgeDesktop]}>
        <Icon name="map-marker-alt" size={isDesktop ? 16 : 12} color="#fff" style={styles.badgeIcon} />
        <Text style={[styles.regionText, isDesktop && styles.regionTextDesktop]}>{regionText}</Text>
      </View>

      {/* Sync Button */}
      {dbReady && (
        <View style={styles.syncButtonContainer}>
          <TouchableOpacity
            style={[styles.syncButton, isDesktop && styles.syncButtonDesktop]}
            onPress={onSync}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size={isDesktop ? "large" : "small"} color="rgba(33, 150, 243, 0.95)" />
            ) : (
              <Icon name="sync-alt" size={isDesktop ? 22 : 16} color="rgba(33, 150, 243, 0.95)" />
            )}
            
            {/* Network Status Dot */}
            {!refreshing && (
              <View style={[
                styles.statusDot, 
                isDesktop && styles.statusDotDesktop,
                isOnline ? styles.statusOnline : styles.statusOffline
              ]} />
            )}
          </TouchableOpacity>
          
          {/* Network Status Text */}
          <View style={[
            styles.statusTextContainer, 
            isDesktop && styles.statusTextContainerDesktop,
            isOnline ? styles.statusTextOnline : styles.statusTextOffline
          ]}>
            <Text style={[styles.statusText, isDesktop && styles.statusTextDesktop]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>

          {/* SOS Button */}
          <TouchableOpacity
            style={[styles.sosButton, isDesktop && styles.sosButtonDesktop, isSOSDisabled && styles.sosButtonDisabled]}
            onPress={handleSOSPress}
            disabled={isSOSDisabled}
            accessibilityLabel="Send SOS"
            accessibilityHint="Alert nearby users that you need help"
          >
            {isCreatingSOS ? (
              <ActivityIndicator size={isDesktop ? "large" : "small"} color="#FF0000" />
            ) : (
              <Icon name="phone" size={isDesktop ? 22 : 16} color="#FF0000" library="fa5" />
            )}
          </TouchableOpacity>

          {/* SOS Status Text */}
          <View style={[
            styles.sosTextContainer,
            isDesktop && styles.sosTextContainerDesktop,
            isSOSDisabled ? styles.sosTextActive : styles.sosTextInactive
          ]}>
            <Text style={[styles.sosText, isDesktop && styles.sosTextDesktop]}>
              {myActiveSOSRequest ? 'SOS Active' : 'Send SOS'}
            </Text>
          </View>
        </View>
      )}

      {/* Current location info - Only show when NO active trail */}
      {location && !activeTrail && (
        <View style={[styles.locationInfo, isSmallScreen && styles.locationInfoSmall]}>
          <Icon name="map-marker-alt" size={isSmallScreen ? 12 : 16} color="#fff" style={styles.locationIcon} />
          <View style={styles.locationTextContainer}>
            <Text style={[styles.locationText, isSmallScreen && styles.locationTextSmall]}>
              {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
            </Text>
            <Text style={[styles.accuracyText, isSmallScreen && styles.accuracyTextSmall]}>
              ±{location.coords.accuracy?.toFixed(0)}m
            </Text>
          </View>
        </View>
      )}

      {/* Database status indicator */}
      {!dbReady && (
        <View style={styles.dbStatusContainer}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.dbStatusText}>Initializing database...</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  regionBadge: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    boxShadow: '0px 2px 4px 0px rgba(0, 0, 0, 0.25)',
    elevation: 5,
    zIndex: 1000,
  },
  regionBadgeDesktop: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
  },
  badgeIcon: {
    marginRight: 0,
  },
  regionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  regionTextDesktop: {
    fontSize: 16,
    fontWeight: '700',
  },
  syncButtonContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    alignItems: 'flex-end',
    gap: 8,
    zIndex: 1000,
  },
  syncButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 2px 4px 0px rgba(0, 0, 0, 0.25)',
    elevation: 5,
  },
  syncButtonDesktop: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  statusDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  statusDotDesktop: {
    width: 16,
    height: 16,
    borderRadius: 8,
    top: 3,
    right: 3,
    borderWidth: 3,
  },
  statusOnline: {
    backgroundColor: '#4CAF50',
  },
  statusOffline: {
    backgroundColor: '#F44336',
  },
  statusTextContainer: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusTextContainerDesktop: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  statusTextOnline: {
    backgroundColor: 'rgba(76, 175, 80, 0.95)',
  },
  statusTextOffline: {
    backgroundColor: 'rgba(244, 67, 54, 0.95)',
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextDesktop: {
    fontSize: 15,
    fontWeight: '700',
  },
  sosButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 2px 4px 0px rgba(0, 0, 0, 0.25)',
    elevation: 5,
  },
  sosButtonDesktop: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  sosButtonDisabled: {
    backgroundColor: '#999',
    opacity: 0.6,
  },
  sosTextContainer: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sosTextContainerDesktop: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  sosTextActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.95)', // Red for active SOS
  },
  sosTextInactive: {
    backgroundColor: 'rgba(255, 152, 0, 0.95)', // Orange for send SOS
  },
  sosText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  sosTextDesktop: {
    fontSize: 15,
    fontWeight: '700',
  },
  dbStatusContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    boxShadow: '0px 2px 4px 0px rgba(0, 0, 0, 0.25)',
    elevation: 5,
    zIndex: 1000,
  },
  dbStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Location info for web - responsive design
  locationInfo: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: '400px' as any, // Responsive width
    zIndex: 1000,
    boxShadow: '0px 2px 8px 0px rgba(0, 0, 0, 0.3)',
  },
  locationIcon: {
    marginRight: 0,
  },
  locationTextContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  locationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
    flexShrink: 1, // Allow text to shrink on small screens
  },
  accuracyText: {
    color: '#aaa',
    fontSize: 12,
  },
  // Small screen adjustments
  locationInfoSmall: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  locationTextSmall: {
    fontSize: 11,
    marginBottom: 2,
  },
  accuracyTextSmall: {
    fontSize: 10,
  },
});
