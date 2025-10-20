/**
 * TrailBottomBar Component
 * 
 * Displays active trail information at the bottom of the map
 * Shows: destination, distance, ETA, and controls
 */

import { Icon } from '@/components/Icon';
import { useTrail } from '@/contexts/TrailContext';
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
  
  // Use the marker color directly instead of trail context color
  const markerColor = activeTrail.color;
  const markerType = activeTrail.targetMarker.type;
  const isOfflineRoute = activeTrail.route.strategy === 'offline';
  
  // Get appropriate icon based on marker type
  const getMarkerIcon = () => {
    switch (markerType) {
      case 'safe': return 'shield-alt';
      case 'danger': return 'exclamation-triangle';
      case 'uncertain': return 'question-circle';
      case 'medical': return 'medkit';
      case 'food': return 'utensils';
      case 'shelter': return 'home';
      case 'checkpoint': return 'flag-checkered';
      case 'combat': return 'crosshairs';
      case 'sos': return 'phone';
      default: return 'map-marker-alt';
    }
  };
  
  return (
    <View style={[styles.container, { borderTopColor: markerColor }]}>
      {/* Trail Info */}
      <View style={styles.infoSection}>
        <Text style={[styles.label, { color: markerColor }]} numberOfLines={1}>
          <Icon name={getMarkerIcon()} size={12} color={markerColor} library="fa5" /> Navigating
          {isOfflineRoute && ' (Offline)'}
        </Text>
        <Text style={styles.destination} numberOfLines={1}>
          <Icon name="map-marker-alt" size={12} color="#666" library="fa5" /> {activeTrail.targetMarker.title}
        </Text>
        <Text style={styles.stats}>
          {formatDistance(activeTrail.distanceRemaining)} • <Icon name="clock" size={10} color="#666" library="fa5" /> {activeTrail.etaMinutes} min
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
    boxShadow: '0px -2px 4px 0px rgba(0, 0, 0, 0.1)',
    elevation: 8,
    zIndex: 1001, // Higher than location info (1000) to appear in front
  },
  
  infoSection: {
    flex: 1,
    marginRight: 16,
  },
  
  label: {
    fontSize: 12,
    fontWeight: '600',
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
