/**
 * SOS Details Modal
 * Shows different views based on user role (creator/responder/viewer)
 */

import { Alert } from '@/components/Alert';
import { Icon } from '@/components/Icon';
import { useSOS } from '@/contexts/SOSContext';
import { useTrail } from '@/contexts/TrailContext';
import { SOSMarker, SOSResponse } from '@/types/sos';
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

interface SOSDetailsModalProps {
  visible: boolean;
  sosMarker: SOSMarker | null;
  onClose: () => void;
}

export function SOSDetailsModal({ visible, sosMarker, onClose }: SOSDetailsModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { getSOSResponsesForMarker, completeSOSRequest, respondToSOS, cancelSOSResponse, myActiveSOSRequest, myActiveSOSResponse } = useSOS();
  const { createTrail } = useTrail();
  const [responses, setResponses] = useState<SOSResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResponding, setIsResponding] = useState(false);

  // Fetch responses when modal opens
  useEffect(() => {
    if (visible && sosMarker) {
      loadResponses();
      
      // Refresh responses every 5 seconds
      const interval = setInterval(() => {
        loadResponses();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [visible, sosMarker?.id]);

  const loadResponses = async () => {
    if (!sosMarker) return;
    
    try {
      const data = await getSOSResponsesForMarker(sosMarker.id);
      setResponses(data);
    } catch (error) {
      console.error('Error loading responses:', error);
    }
  };

  if (!sosMarker) return null;

  const isCreator = myActiveSOSRequest && myActiveSOSRequest.id === sosMarker.id;
  const isResponder = myActiveSOSResponse && myActiveSOSResponse.sosMarkerId === sosMarker.id;
  const responseCount = responses.length;
  const isFull = responseCount >= 5;

  const handleComplete = () => {
    Alert.alert(
      'Mark as Completed?',
      'This will notify all responders that you have received help.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          style: 'default',
          onPress: async () => {
            setIsLoading(true);
            try {
              await completeSOSRequest(sosMarker.id);
              onClose();
            } catch (error) {
              console.error('Error completing SOS:', error);
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleRespond = async () => {
    setIsResponding(true);
    try {
      // Add response to database
      await respondToSOS(sosMarker.id);
      
      // Create trail to SOS location
      const sosAsMarker: any = {
        id: sosMarker.id,
        type: 'sos',
        latitude: sosMarker.latitude,
        longitude: sosMarker.longitude,
        title: 'SOS Emergency',
        description: 'Someone needs help!',
        createdBy: sosMarker.createdBy,
        createdAt: sosMarker.createdAt,
        lastVerified: sosMarker.createdAt,
        agrees: 0,
        disagrees: 0,
        confidenceScore: 100,
        syncedToServer: false
      };
      
      await createTrail(sosAsMarker, TrailContext.SOS_RESPONSE);
      
      onClose();
    } catch (error: any) {
      console.error('Error responding to SOS:', error);
      Alert.alert('Error', error.message || 'Failed to respond to SOS');
    } finally {
      setIsResponding(false);
    }
  };

  const handleCancelResponse = () => {
    Alert.alert(
      'Cancel Response?',
      'Are you sure you want to stop responding to this SOS?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await cancelSOSResponse(sosMarker.id);
              onClose();
            } catch (error) {
              console.error('Error cancelling response:', error);
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const formatDistance = (meters: number | null) => {
    if (meters === null) return 'Unknown';
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const formatETA = (minutes: number | null) => {
    if (minutes === null) return 'Unknown';
    return `${minutes} min`;
  };

  // CREATOR VIEW
  if (isCreator) {
    return (
      <Modal visible={visible} animationType={isDesktop ? "fade" : "slide"} transparent={true} onRequestClose={onClose} statusBarTranslucent={true}>
        <View style={[styles.overlay, isDesktop && styles.overlayDesktop]}>
          <TouchableOpacity style={styles.overlayTouchable} activeOpacity={1} onPress={onClose} />
          <View style={[styles.modal, isDesktop && styles.modalDesktop]}>
            {/* Header */}
            <View style={[styles.header, sosMarker.status === 'completed' ? styles.headerCompleted : styles.headerActive]}>
              <View style={styles.headerContent}>
                <Icon name="phone" size={32} color="#fff" library="fa5" />
                <View style={styles.headerText}>
                  <Text style={styles.headerTitle}>
                    {sosMarker.status === 'completed' ? 'SOS Completed' : 'Your SOS Request'}
                  </Text>
                  <Text style={styles.headerSubtitle}>
                    {sosMarker.status === 'completed' ? 'Help Received' : 'Active'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Icon name="times" size={24} color="#fff" library="fa5" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Status */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>People Responding ({responseCount}/5)</Text>
                
                {responseCount === 0 ? (
                  <View style={styles.emptyState}>
                    <Icon name="hourglass-half" size={32} color="#999" library="fa5" />
                    <Text style={styles.emptyText}>Waiting for nearby users to respond...</Text>
                  </View>
                ) : (
                  <View style={styles.respondersList}>
                    {responses.map((response) => (
                      <View key={response.id} style={styles.responderItem}>
                        <Icon name="user-circle" size={24} color="#007AFF" library="fa5" />
                        <View style={styles.responderInfo}>
                          <Text style={styles.responderName}>
                            {response.responderDeviceId.substring(0, 15)}...
                          </Text>
                          <Text style={styles.responderDetails}>
                            {formatDistance(response.distanceMeters)} away • ETA {formatETA(response.etaMinutes)}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {sosMarker.status === 'completed' && (
                <View style={styles.infoBox}>
                  <Icon name="check-circle" size={16} color="#22C55E" library="fa5" />
                  <Text style={styles.infoText}>
                    This SOS will be removed from the map in a few minutes.
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Actions */}
            {sosMarker.status === 'active' && (
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.completeButton]}
                  onPress={handleComplete}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="check" size={20} color="#fff" library="fa5" />
                      <Text style={styles.actionButtonText}>Mark as Completed</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  // RESPONDER VIEW
  if (isResponder) {
    return (
      <Modal visible={visible} animationType={isDesktop ? "fade" : "slide"} transparent={true} onRequestClose={onClose} statusBarTranslucent={true}>
        <View style={[styles.overlay, isDesktop && styles.overlayDesktop]}>
          <TouchableOpacity style={styles.overlayTouchable} activeOpacity={1} onPress={onClose} />
          <View style={[styles.modal, isDesktop && styles.modalDesktop]}>
            {/* Header */}
            <View style={[styles.header, styles.headerResponding]}>
              <View style={styles.headerContent}>
                <Icon name="hands-helping" size={32} color="#fff" library="fa5" />
                <View style={styles.headerText}>
                  <Text style={styles.headerTitle}>Responding to SOS</Text>
                  <Text style={styles.headerSubtitle}>You're on your way</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Icon name="times" size={24} color="#fff" library="fa5" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Other Responders */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>People Responding ({responseCount}/5)</Text>
                
                <View style={styles.respondersList}>
                  {responses.map((response) => {
                    const isMe = myActiveSOSResponse && response.id === myActiveSOSResponse.id;
                    
                    return (
                      <View key={response.id} style={[styles.responderItem, isMe && styles.responderItemMe]}>
                        <Icon name="user-circle" size={24} color={isMe ? '#22C55E' : '#007AFF'} library="fa5" />
                        <View style={styles.responderInfo}>
                          <Text style={styles.responderName}>
                            {isMe ? 'You' : `${response.responderDeviceId.substring(0, 15)}...`}
                          </Text>
                          <Text style={styles.responderDetails}>
                            {formatDistance(response.distanceMeters)} away • ETA {formatETA(response.etaMinutes)}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              <View style={styles.infoBox}>
                <Icon name="info-circle" size={16} color="#3B82F6" library="fa5" />
                <Text style={styles.infoText}>
                  Follow the trail on the map to reach the person in need.
                </Text>
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.cancelButton]}
                onPress={handleCancelResponse}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Icon name="times" size={20} color="#fff" library="fa5" />
                    <Text style={styles.actionButtonText}>Cancel My Response</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // VIEWER VIEW (not creator or responder)
  return (
    <Modal visible={visible} animationType={isDesktop ? "fade" : "slide"} transparent={true} onRequestClose={onClose} statusBarTranslucent={true}>
      <View style={[styles.overlay, isDesktop && styles.overlayDesktop]}>
        <TouchableOpacity style={styles.overlayTouchable} activeOpacity={1} onPress={onClose} />
        <View style={[styles.modal, isDesktop && styles.modalDesktop]}>
          {/* Header */}
          <View style={[styles.header, styles.headerSOS]}>
            <View style={styles.headerContent}>
              <Icon name="phone" size={32} color="#fff" library="fa5" />
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>Someone Needs Help!</Text>
                <Text style={styles.headerSubtitle}>SOS Emergency Request</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="times" size={24} color="#fff" library="fa5" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Response Status */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {responseCount} {responseCount === 1 ? 'person is' : 'people are'} responding
              </Text>
              
              {isFull && (
                <View style={styles.fullBadge}>
                  <Icon name="users" size={16} color="#F59E0B" library="fa5" />
                  <Text style={styles.fullBadgeText}>Maximum responders reached (5/5)</Text>
                </View>
              )}
            </View>

            <View style={styles.infoBox}>
              <Icon name="info-circle" size={16} color="#3B82F6" library="fa5" />
              <Text style={styles.infoText}>
                A nearby user needs assistance. If you can help, click the button below.
              </Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.dismissButton]}
              onPress={onClose}
            >
              <Text style={[styles.actionButtonText, styles.dismissButtonText]}>Dismiss</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.helpButton, isFull && styles.helpButtonDisabled]}
              onPress={handleRespond}
              disabled={isFull || isResponding}
            >
              {isResponding ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Icon name="hands-helping" size={20} color="#fff" library="fa5" />
                  <Text style={styles.actionButtonText}>{isFull ? 'Full' : 'Help'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
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
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  } as const,
  modalDesktop: {
    borderRadius: 20,
    maxWidth: 500,
    width: '100%',
    maxHeight: 700,
  } as const,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerActive: {
    backgroundColor: '#FF0000',
  },
  headerCompleted: {
    backgroundColor: '#22C55E',
  },
  headerResponding: {
    backgroundColor: '#007AFF',
  },
  headerSOS: {
    backgroundColor: '#FF0000',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    maxHeight: 400,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  respondersList: {
    gap: 12,
  },
  responderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  responderItemMe: {
    backgroundColor: '#E6F7E6',
    borderWidth: 2,
    borderColor: '#22C55E',
  },
  responderInfo: {
    flex: 1,
  },
  responderName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  responderDetails: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: '#EBF5FF',
    borderRadius: 8,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#3B82F6',
  },
  fullBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    marginTop: 8,
  },
  fullBadgeText: {
    fontSize: 13,
    color: '#F59E0B',
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
  },
  completeButton: {
    backgroundColor: '#22C55E',
  },
  cancelButton: {
    backgroundColor: '#EF4444',
  },
  dismissButton: {
    backgroundColor: '#E5E5E5',
  },
  helpButton: {
    backgroundColor: '#007AFF',
  },
  helpButtonDisabled: {
    backgroundColor: '#999',
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  dismissButtonText: {
    color: '#333',
  },
});
