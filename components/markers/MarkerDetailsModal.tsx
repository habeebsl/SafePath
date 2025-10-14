import { Icon } from '@/components/Icon';
import { MARKER_CONFIG } from '@/constants/marker-icons';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useTrail } from '@/contexts/TrailContext';
import { Marker } from '@/types/marker';
import { TrailContext } from '@/types/trail';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { MarkerIcon } from './MarkerIcon';
import { uiLogger } from '@/utils/logger';

interface MarkerDetailsModalProps {
  visible: boolean;
  marker: Marker | null;
  userVote?: 'agree' | 'disagree' | null; // Make optional since we'll fetch it
  onClose: () => void;
  onVote?: (vote: 'agree' | 'disagree') => void; // Make optional
}

export function MarkerDetailsModal({
  visible,
  marker: initialMarker,
  userVote: providedUserVote,
  onClose,
  onVote: providedOnVote,
}: MarkerDetailsModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { markers, voteOnMarker, getUserVoteForMarker, refreshMarkers, deviceId } = useDatabase();
  const { createTrail } = useTrail();
  const [userVote, setUserVote] = useState<'agree' | 'disagree' | null>(providedUserVote || null);
  const [isVoting, setIsVoting] = useState(false);
  const [isLoadingVote, setIsLoadingVote] = useState(false);
  const [currentMarker, setCurrentMarker] = useState<Marker | null>(initialMarker);

  // Update current marker when markers array changes (to get fresh vote counts)
  useEffect(() => {
    if (initialMarker) {
      const freshMarker = markers.find(m => m.id === initialMarker.id);
      if (freshMarker) {
        uiLogger.info('🔄 Updated marker with fresh data:', freshMarker.id, 'agrees:', freshMarker.agrees, 'disagrees:', freshMarker.disagrees);
        setCurrentMarker(freshMarker);
      } else {
        setCurrentMarker(initialMarker);
      }
    } else {
      setCurrentMarker(null);
    }
  }, [initialMarker, markers]);

  // Fetch user's vote when modal opens
  useEffect(() => {
    if (visible && currentMarker) {
      setIsLoadingVote(true);
      getUserVoteForMarker(currentMarker.id)
        .then((vote) => {
          setUserVote(vote);
        })
        .catch((error) => {
          uiLogger.error('Error fetching user vote:', error);
        })
        .finally(() => {
          setIsLoadingVote(false);
        });
    }
  }, [visible, currentMarker?.id]);

  // Early return AFTER all hooks
  if (!currentMarker) return null;

  const marker = currentMarker;

  const config = MARKER_CONFIG[marker.type];
  const totalVotes = marker.agrees + marker.disagrees;
  const timeAgo = getTimeAgo(marker.lastVerified);
  const isOwnMarker = deviceId && marker.createdBy === deviceId;

  // Handle voting
  const handleVote = async (vote: 'agree' | 'disagree') => {
    if (!marker || isVoting) return;

    setIsVoting(true);
    try {
      await voteOnMarker(marker.id, vote);
      setUserVote(vote);
      
      // Refresh markers to get updated counts
      await refreshMarkers();
      
      // Call provided onVote callback if exists
      if (providedOnVote) {
        providedOnVote(vote);
      }
      
      // Close modal after successful vote
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error: any) {
      uiLogger.error('Error voting:', error);
      alert(error.message || 'Failed to record vote. Please try again.');
    } finally {
      setIsVoting(false);
    }
  };

  // Handle navigation
  const handleNavigate = async () => {
    if (!marker) return;
    
    try {
      // Determine trail context based on marker type
      let trailContext: TrailContext;
      switch (marker.type) {
        case 'safe':
        case 'shelter':
        case 'medical':
          trailContext = TrailContext.NAVIGATE_TO_SAFE;
          break;
        case 'danger':
        case 'combat':
          trailContext = TrailContext.AVOID_DANGER;
          break;
        default:
          trailContext = TrailContext.CUSTOM;
      }
      
      await createTrail(marker, trailContext);
      onClose();
    } catch (error) {
      uiLogger.error('Error creating trail:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType={isDesktop ? "fade" : "slide"}
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={[styles.overlay, isDesktop && styles.overlayDesktop]}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.modal, isDesktop && styles.modalDesktop]}>
            {/* Header with marker type */}
            <View style={[styles.header, { backgroundColor: config.color + '20' }]}>
              <View style={styles.headerTop}>
                <View style={[styles.markerBadge, { backgroundColor: config.color }]}>
                  <MarkerIcon type={marker.type} size={28} color="#fff" />
                </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.markerType, { color: config.color }]}>
                  {config.label}
                </Text>
                <Text style={styles.markerTitle}>{marker.title}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView 
            style={styles.content} 
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            removeClippedSubviews={true}
            overScrollMode="never"
          >
            {/* Location Info */}
            <View style={styles.infoRow}>
              <Icon name="map-marker-alt" size={16} color="#666" style={styles.infoIcon} />
              <Text style={styles.infoText}>
                {marker.latitude.toFixed(4)}°N, {marker.longitude.toFixed(4)}°E
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Icon name="clock" size={16} color="#666" style={styles.infoIcon} />
              <Text style={styles.infoText}>Updated {timeAgo}</Text>
            </View>

            {/* Description */}
            {marker.description && (
              <View style={styles.descriptionBox}>
                <Text style={styles.description}>{marker.description}</Text>
              </View>
            )}

            {/* Confidence Score */}
            <View style={styles.confidenceSection}>
              <View style={styles.confidenceHeader}>
                <Text style={styles.sectionTitle}>Community Confidence</Text>
                <Text style={[styles.confidenceScore, getConfidenceStyle(marker.confidenceScore)]}>
                  {Math.round(marker.confidenceScore)}%
                </Text>
              </View>
              
              {/* Confidence Bar */}
              <View style={styles.confidenceBar}>
                <View
                  style={[
                    styles.confidenceFill,
                    {
                      width: `${marker.confidenceScore}%`,
                      backgroundColor: getConfidenceColor(marker.confidenceScore),
                    },
                  ]}
                />
              </View>

              {/* Votes */}
              <View style={styles.votesRow}>
                <View style={styles.voteItem}>
                  <Text style={styles.voteCount}>{marker.agrees}</Text>
                  <View style={styles.voteLabelContainer}>
                    <Icon name="check-circle" size={14} color="#4CAF50" />
                    <Text style={styles.voteLabel}>Agree</Text>
                  </View>
                </View>
                <View style={styles.voteDivider} />
                <View style={styles.voteItem}>
                  <Text style={styles.voteCount}>{marker.disagrees}</Text>
                  <View style={styles.voteLabelContainer}>
                    <Icon name="times-circle" size={14} color="#F44336" />
                    <Text style={styles.voteLabel}>Disagree</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* User's Vote */}
            <View style={styles.voteSection}>
              <Text style={styles.sectionTitle}>Your Vote</Text>
              {isOwnMarker ? (
                <View style={styles.ownMarkerContainer}>
                  <Icon name="info-circle" size={16} color="#666" />
                  <Text style={styles.ownMarkerText}>
                    You created this marker. You cannot vote on your own markers.
                  </Text>
                </View>
              ) : isLoadingVote ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#666" />
                  <Text style={styles.loadingText}>Checking your vote...</Text>
                </View>
              ) : userVote ? (
                <Text style={styles.votedText}>
                  You {userVote === 'agree' ? 'agreed' : 'disagreed'} with this marker
                </Text>
              ) : (
                <>
                  <Text style={styles.votePrompt}>
                    Help verify this information. Are you at or near this location?
                  </Text>
                  <View style={styles.voteButtons}>
                    <TouchableOpacity
                      style={[
                        styles.voteButton,
                        styles.agreeButton,
                        isVoting && styles.voteButtonDisabled
                      ]}
                      onPress={() => handleVote('agree')}
                      disabled={isVoting}
                    >
                      {isVoting ? (
                        <ActivityIndicator size="small" color="#22C55E" />
                      ) : (
                        <>
                          <View style={styles.voteButtonContent}>
                            <Icon name="thumbs-up" size={20} color="#22C55E" />
                            <Text style={styles.voteButtonText}>Agree</Text>
                          </View>
                          <Text style={styles.voteButtonSubtext}>Information is accurate</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[
                        styles.voteButton,
                        styles.disagreeButton,
                        isVoting && styles.voteButtonDisabled
                      ]}
                      onPress={() => handleVote('disagree')}
                      disabled={isVoting}
                    >
                      {isVoting ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <>
                          <View style={styles.voteButtonContent}>
                            <Icon name="thumbs-down" size={20} color="#EF4444" />
                            <Text style={styles.voteButtonText}>Disagree</Text>
                          </View>
                          <Text style={styles.voteButtonSubtext}>Information is incorrect</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>

            {/* Safety Warning */}
            <View style={styles.warningBox}>
              <Icon name="exclamation-triangle" size={16} color="#FF9800" style={styles.warningIcon} />
              <Text style={styles.warningText}>
                Always verify information on the ground. Situations can change rapidly.
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity 
              style={styles.navigateButton} 
              onPress={handleNavigate}
            >
              <Icon name="location-arrow" size={18} color="#FFFFFF" library="fa5" />
              <Text style={styles.navigateButtonText}>Navigate Here</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.closeActionButton} 
              onPress={onClose}
            >
              <Text style={styles.closeActionButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}// Helper functions
function getTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return '#22C55E'; // Green
  if (confidence >= 50) return '#F59E0B'; // Yellow
  if (confidence >= 20) return '#F97316'; // Orange
  return '#EF4444'; // Red
}

function getConfidenceStyle(confidence: number) {
  return {
    color: getConfidenceColor(confidence),
  };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  } as const,
  overlayDesktop: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  } as const,
  overlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  } as const,
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  } as const,
  modalDesktop: {
    borderRadius: 20,
    maxWidth: 500,
    width: '100%',
    maxHeight: 700,
  } as const,
  header: {
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  } as const,
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markerBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  markerBadgeText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  headerTextContainer: {
    flex: 1,
  },
  markerType: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  markerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },
  content: {
    maxHeight: 500,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoIcon: {
    marginRight: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
  },
  descriptionBox: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 20,
  },
  description: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  confidenceSection: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  confidenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  confidenceScore: {
    fontSize: 24,
    fontWeight: '700',
  },
  confidenceBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 4,
  },
  votesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  voteItem: {
    flex: 1,
    alignItems: 'center',
  },
  voteDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#ddd',
  },
  voteCount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  voteLabel: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  voteLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteSection: {
    marginBottom: 20,
  },
  ownMarkerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  ownMarkerText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  votedText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
  },
  votePrompt: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    marginBottom: 12,
  },
  voteButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  voteButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
  },
  voteButtonDisabled: {
    opacity: 0.6,
  },
  voteButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  agreeButton: {
    backgroundColor: '#DCFCE7',
    borderColor: '#22C55E',
  },
  disagreeButton: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  voteButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  voteButtonSubtext: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center'
  },
  warningBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  warningIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  warningText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
    flex: 1,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    flexDirection: 'row',
    gap: 12,
  },
  navigateButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  navigateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeActionButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeActionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
});
