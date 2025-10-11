/**
 * Map UI overlays - badges, status indicators, and buttons
 */

import { Icon } from '@/components/Icon';
import region from '@/config/region.json';
import { LocationObject } from 'expo-location';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface MapOverlaysProps {
  isTracking: boolean;
  dbReady: boolean;
  location: LocationObject | null;
  isOnline: boolean;
  refreshing: boolean;
  onSync: () => void;
}

export function MapOverlays({
  isTracking,
  dbReady,
  location,
  isOnline,
  refreshing,
  onSync,
}: MapOverlaysProps) {
  return (
    <>
      {/* Region badge */}
      <View style={styles.regionBadge}>
        <Icon name="map-marker-alt" size={12} color="#fff" style={styles.badgeIcon} />
        <Text style={styles.regionText}>{region.displayName}</Text>
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

      {/* Current location info */}
      {location && (
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
