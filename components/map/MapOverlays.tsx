/**
 * Map UI overlays - badges, status indicators, and buttons
 */

import { Icon } from '@/components/Icon';
import { LocationTrackingStatus } from '@/hooks/useLocationTracking';
import { Trail } from '@/types/trail';
import { getLocationDisplayText } from '@/utils/region-helpers';
import { LocationObject } from 'expo-location';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  const regionText = getLocationDisplayText(currentCountry, isLocating);
  
  return (
    <>
      {/* Region badge - Top Left */}
      <View style={styles.regionBadge}>
        <Icon name="map-marker-alt" size={12} color="#000" style={styles.badgeIcon} />
        <Text style={styles.regionText}>{regionText}</Text>
      </View>

      {/* Error Status Badge - Only show on errors */}
      {(trackingStatus === 'permission-denied' || 
        trackingStatus === 'location-disabled' || 
        trackingStatus === 'error') && (
        <View style={styles.errorBadge}>
          <Icon name="exclamation-circle" size={12} color="#fff" style={styles.badgeIcon} />
          <Text style={styles.errorText}>
            {trackingStatus === 'permission-denied' && 'Location Permission Denied'}
            {trackingStatus === 'location-disabled' && 'Location Services Off'}
            {trackingStatus === 'error' && 'Location Error'}
          </Text>
        </View>
      )}

      {/* Sync Button - Bottom Right (top of button stack) */}
      {dbReady && (
        <TouchableOpacity
          style={[
            styles.syncButton,
            !isOnline && styles.syncButtonOffline,
          ]}
          onPress={onSync}
          disabled={refreshing}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={isOnline ? '#2196F3' : '#999'} />
          ) : (
            <Icon name="sync-alt" size={20} color={isOnline ? '#2196F3' : '#999'} />
          )}
        </TouchableOpacity>
      )}

      {/* Current location info - only show when no active trail */}
      {location && !activeTrail && (
        <View style={styles.locationInfo}>
          <View style={styles.locationTextContainer}>
            <View style={styles.coordinatesRow}>
              <Icon name="map-marker-alt" size={14} color="#fff" style={styles.locationIcon} />
              <Text style={styles.locationText}>
                {location.coords.latitude.toFixed(4)}, {location.coords.longitude.toFixed(4)}
              </Text>
            </View>
            <Text style={styles.accuracyText}>
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
    left: 10,
    backgroundColor: 'white',
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
  badgeIcon: {
    marginRight: 0,
  },
  regionText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '600',
  },
  errorBadge: {
    position: 'absolute',
    top: 100,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    boxShadow: '0px 2px 4px 0px rgba(0, 0, 0, 0.25)',
    elevation: 5,
    zIndex: 1000,
  },
  errorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  syncButton: {
    position: 'absolute',
    bottom: 360, // Top of button stack
    right: 10,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 2px 4px 0px rgba(0, 0, 0, 0.25)',
    elevation: 5,
    zIndex: 1000,
  },
  syncButtonOffline: {
    backgroundColor: '#FFFFFF', // Keep white background even when offline
  },
  dbStatusContainer: {
    position: 'absolute',
    top: 110,
    right: 10,
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
  locationInfo: {
    position: 'absolute',
    bottom: 20,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 1000,
  },
  locationIcon: {
    marginRight: 0,
  },
  locationTextContainer: {
    flex: 1,
    flexDirection: 'column'
  },
  coordinatesRow: {
    gap: 5,
    flexDirection: 'row',
    alignItems: 'center'
  },
  locationText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  accuracyText: {
    color: '#aaa',
    fontSize: 12,
  },
});
