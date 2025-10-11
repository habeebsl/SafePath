/**
 * Map UI overlays - badges, status indicators, and buttons (Web version)
 * Responsive design that adapts to different screen sizes
 */

import { Icon } from '@/components/Icon';
import { Trail } from '@/types/trail';
import { getLocationDisplayText } from '@/utils/region-helpers';
import { LocationObject } from 'expo-location';
import React from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface MapOverlaysProps {
  isTracking: boolean;
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
  dbReady,
  location,
  isOnline,
  refreshing,
  onSync,
  activeTrail,
  currentCountry,
  isLocating,
}: MapOverlaysProps) {
  console.log('🌐 MapOverlays.web.tsx rendering - location:', !!location, 'activeTrail:', !!activeTrail);
  console.log('🏷️ Region badge - currentCountry:', currentCountry, 'isLocating:', isLocating);
  
  const screenWidth = Dimensions.get('window').width;
  const isSmallScreen = screenWidth < 600;
  const regionText = getLocationDisplayText(currentCountry, isLocating);
  console.log('📝 Region text:', regionText);
  
  return (
    <>
      {/* Region badge */}
      <View style={styles.regionBadge}>
        <Icon name="map-marker-alt" size={12} color="#fff" style={styles.badgeIcon} />
        <Text style={styles.regionText}>{regionText}</Text>
      </View>

      {/* Tracking status */}
      {isTracking && (
        <View style={styles.trackingBadge}>
          <View style={styles.trackingDot} />
          <Text style={styles.trackingText}>Tracking</Text>
        </View>
      )}

      {/* Sync Button */}
      {dbReady && (
        <View style={styles.syncButtonContainer}>
          <TouchableOpacity
            style={styles.syncButton}
            onPress={onSync}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Icon name="sync-alt" size={16} color="#fff" />
            )}
            
            {/* Network Status Dot */}
            {!refreshing && (
              <View style={[styles.statusDot, isOnline ? styles.statusOnline : styles.statusOffline]} />
            )}
          </TouchableOpacity>
          
          {/* Network Status Text */}
          <View style={[styles.statusTextContainer, isOnline ? styles.statusTextOnline : styles.statusTextOffline]}>
            <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
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
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  badgeIcon: {
    marginRight: 0,
  },
  regionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  trackingBadge: {
    position: 'absolute',
    top: 60,
    right: 10,
    backgroundColor: 'rgba(76, 175, 80, 0.95)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  trackingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  trackingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  syncButtonContainer: {
    position: 'absolute',
    top: 110,
    right: 10,
    alignItems: 'flex-end',
    gap: 8,
    zIndex: 1000,
  },
  syncButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(33, 150, 243, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  statusDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(33, 150, 243, 0.95)',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
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
    left: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: '100%' as any, // Responsive width
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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
