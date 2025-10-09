/**
 * TrailBottomBar Component
 * 
 * Displays active trail information at the bottom of the map
 * Shows: destination, distance, ETA, and controls
 */

import { Icon } from '@/components/Icon';
import { useTrail } from '@/contexts/TrailContext';
import { TRAIL_STYLES } from '@/types/trail';
import { formatDistance } from '@/utils/routing';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export function TrailBottomBar() {
  const { activeTrail, isLoading, cancelTrail } = useTrail();
  
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={styles.loadingText}>Calculating route...</Text>
      </View>
    );
  }
  
  if (!activeTrail) {
    return null;
  }
  
  const trailStyle = TRAIL_STYLES[activeTrail.context];
  const isOfflineRoute = activeTrail.route.strategy === 'offline';
  
  return (
    <View style={[styles.container, { borderTopColor: trailStyle.color }]}>
      {/* Trail Info */}
      <View style={styles.infoSection}>
        <Text style={styles.label} numberOfLines={1}>
          {trailStyle.label}
          {isOfflineRoute && ' (Offline)'}
        </Text>
        <Text style={styles.destination} numberOfLines={1}>
          📍 {activeTrail.targetMarker.title}
        </Text>
        <Text style={styles.stats}>
          {formatDistance(activeTrail.distanceRemaining)} • ⏱️ {activeTrail.etaMinutes} min
          {isOfflineRoute && ' ⚠️'}
        </Text>
      </View>
      
      {/* Controls */}
      <View style={styles.controlsSection}>
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={cancelTrail}
          accessibilityLabel="Cancel trail"
        >
          <Icon name="times-circle" size={24} color="#FF3B30" library="fa5" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 3,
    borderTopColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  
  infoSection: {
    flex: 1,
    marginRight: 16,
  },
  
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 2,
  },
  
  destination: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  
  stats: {
    fontSize: 14,
    color: '#666',
  },
  
  controlsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  
  controlButton: {
    padding: 8,
  },
  
  loadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#666',
  },
});
