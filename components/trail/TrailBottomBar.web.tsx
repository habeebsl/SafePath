/**
 * TrailBottomBar Component (Web version)
 * 
 * Displays active trail information at the bottom of the map
 * Responsive layout that adapts to screen size
 */

import { Icon } from '@/components/Icon';
import { useTrail } from '@/contexts/TrailContext';
import { TRAIL_STYLES } from '@/types/trail';
import { formatDistance } from '@/utils/routing';
import React from 'react';
import { ActivityIndicator, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { uiLogger } from '@/utils/logger';

export function TrailBottomBar() {
  const { activeTrail, isLoading, cancelTrail } = useTrail();
  
  uiLogger.info('🌐 TrailBottomBar.web.tsx rendering - activeTrail:', !!activeTrail, 'isLoading:', isLoading);
  
  const screenWidth = Dimensions.get('window').width;
  const isSmallScreen = screenWidth < 600;
  
  if (isLoading) {
    return (
      <View style={[styles.container, isSmallScreen && styles.containerSmall]}>
        <ActivityIndicator size="small" color="#007AFF" />
        <Text style={[styles.loadingText, isSmallScreen && styles.loadingTextSmall]}>Calculating route...</Text>
      </View>
    );
  }
  
  if (!activeTrail) {
    return null;
  }
  
  const trailStyle = TRAIL_STYLES[activeTrail.context];
  const isOfflineRoute = activeTrail.route.strategy === 'offline';
  
  return (
    <View style={[styles.container, { borderLeftColor: trailStyle.color }, isSmallScreen && styles.containerSmall]}>
      {/* Icon indicator */}
      <View style={[styles.iconContainer, { backgroundColor: trailStyle.color }, isSmallScreen && styles.iconContainerSmall]}>
        <Text style={[styles.iconText, isSmallScreen && styles.iconTextSmall]}>🧭</Text>
      </View>
      
      {/* Trail Info - Responsive layout */}
      <View style={styles.infoSection}>
        <View style={styles.destinationRow}>
          <Text style={[styles.destination, isSmallScreen && styles.destinationSmall]} numberOfLines={1}>
            {activeTrail.targetMarker.title}
          </Text>
          {isOfflineRoute && (
            <View style={[styles.offlineBadge, isSmallScreen && styles.offlineBadgeSmall]}>
              <Text style={[styles.offlineText, isSmallScreen && styles.offlineTextSmall]}>⚠️ Offline</Text>
            </View>
          )}
        </View>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Icon name="route" size={isSmallScreen ? 11 : 14} color="#666" library="fa5" style={styles.statIcon} />
            <Text style={[styles.statText, isSmallScreen && styles.statTextSmall]}>{formatDistance(activeTrail.distanceRemaining)}</Text>
          </View>
          
          <View style={styles.separator} />
          
          <View style={styles.statItem}>
            <Icon name="clock" size={isSmallScreen ? 11 : 14} color="#666" library="fa5" style={styles.statIcon} />
            <Text style={[styles.statText, isSmallScreen && styles.statTextSmall]}>{activeTrail.etaMinutes} min</Text>
          </View>
          
          {!isSmallScreen && <View style={styles.separator} />}
          
          {!isSmallScreen && (
            <View style={styles.statItem}>
              <Text style={[styles.label, { color: trailStyle.color }]}>
                {trailStyle.label}
              </Text>
            </View>
          )}
        </View>
      </View>
      
      {/* Cancel Button */}
      <TouchableOpacity 
        style={[styles.cancelButton, isSmallScreen && styles.cancelButtonSmall]}
        onPress={cancelTrail}
        accessibilityLabel="Cancel trail"
      >
        <Icon name="times" size={isSmallScreen ? 16 : 20} color="#666" library="fa5" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20, // Same position as location info - they're mutually exclusive
    left: 10,
    right: 10, // Responsive: stretch to fit available width
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
    paddingVertical: 14,
    maxWidth: '400px' as any,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 1000,
  },
  
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    marginLeft: 10,
  },
  
  iconText: {
    fontSize: 26,
  },
  
  infoSection: {
    flex: 1,
    marginRight: 14,
    gap: 6,
  },
  
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  
  destination: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
    flex: 1,
  },
  
  offlineBadge: {
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  
  offlineText: {
    fontSize: 11,
    color: '#856404',
    fontWeight: '600',
  },
  
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  
  statIcon: {
    marginRight: 0,
  },
  
  statText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  
  separator: {
    width: 1,
    height: 14,
    backgroundColor: '#ddd',
  },
  
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  loadingText: {
    marginLeft: 12,
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  // Small screen adjustments (< 600px)
  containerSmall: {
    paddingRight: 10,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderRadius: 8,
  },
  iconContainerSmall: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 10,
    marginLeft: 6,
  },
  iconTextSmall: {
    fontSize: 20,
  },
  destinationSmall: {
    fontSize: 13,
  },
  offlineBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  offlineTextSmall: {
    fontSize: 9,
  },
  statTextSmall: {
    fontSize: 11,
  },
  cancelButtonSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  loadingTextSmall: {
    fontSize: 12,
  },
});
