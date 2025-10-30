import { Icon } from '@/components/Icon';
import { Toast, ToastType } from '@/components/Toast';
import { MARKER_CONFIG } from '@/constants/marker-icons';
import { getDefaultRadius, MAX_RADIUS, MIN_RADIUS, validateRadius } from '@/constants/marker-radius';
import { useToast } from '@/contexts/ToastContext';
import { MarkerType } from '@/types/marker';
import Slider from '@react-native-community/slider';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { MarkerIcon } from './MarkerIcon';

interface AddMarkerModalProps {
  visible: boolean;
  latitude: number;
  longitude: number;
  onClose: () => void;
  onSave: (data: {
    type: MarkerType;
    title: string;
    description: string;
    latitude: number;
    longitude: number;
    radius?: number;
  }) => void;
  onRadiusPreview?: (radius: number | null, markerType: MarkerType) => void;
}

export function AddMarkerModal({
  visible,
  latitude,
  longitude,
  onClose,
  onSave,
  onRadiusPreview,
}: AddMarkerModalProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const { showToast: showGlobalToast } = useToast();
  const [selectedType, setSelectedType] = useState<MarkerType>('danger');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [radius, setRadius] = useState<number>(getDefaultRadius(selectedType));
  const [radiusText, setRadiusText] = useState<string>(getDefaultRadius(selectedType).toString());
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Local toast state for modal (for errors while modal is open)
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<ToastType>('info');
  
  const showLocalToast = (message: string, type: ToastType = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const handleTypeChange = (type: MarkerType) => {
    setSelectedType(type);
    const defaultRadius = getDefaultRadius(type);
    setRadius(defaultRadius);
    setRadiusText(defaultRadius.toString());
  };

  const handleRadiusSliderChange = (value: number) => {
    setRadius(value);
    setRadiusText(value.toString());
  };

  const handleSliderStart = () => {
    setIsDraggingSlider(true);
  };

  const handleSliderEnd = () => {
    setIsDraggingSlider(false);
  };

  const handleRadiusTextChange = (text: string) => {
    setRadiusText(text);
    const numValue = parseInt(text, 10);
    if (!isNaN(numValue)) {
      setRadius(Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, numValue)));
    }
  };

  // Call preview callback when radius or type changes
  useEffect(() => {
    if (visible && onRadiusPreview) {
      onRadiusPreview(radius > 0 ? radius : null, selectedType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius, selectedType, visible]);

  // Clear preview on close
  useEffect(() => {
    if (!visible && onRadiusPreview) {
      onRadiusPreview(null, selectedType);
    }
    // Reset saving state when modal closes
    if (!visible) {
      setIsSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleSave = async () => {
    console.log('💾 handleSave called - radius state:', radius);
    
    if (!title.trim()) {
      showLocalToast('Please enter a title', 'error');
      return;
    }

    if (!validateRadius(radius)) {
      showLocalToast(`Radius must be between ${MIN_RADIUS}m and ${MAX_RADIUS}m`, 'error');
      return;
    }

    setIsSaving(true);

    // Clear preview BEFORE calling onSave
    if (onRadiusPreview) {
      onRadiusPreview(null, selectedType);
    }

    const markerData = {
      type: selectedType,
      title: title.trim(),
      description: description.trim(),
      latitude,
      longitude,
      radius: radius > 0 ? radius : undefined,
    };
    
    try {
      console.log('📤 Calling onSave with data:', markerData);
      await onSave(markerData);

      // Reset form
      setTitle('');
      setDescription('');
      setSelectedType('danger');
      const defaultRadius = getDefaultRadius('danger');
      setRadius(defaultRadius);
      setRadiusText(defaultRadius.toString());
      
      // Show success toast using GLOBAL toast (modal will close, so need global)
      showGlobalToast('Marker created successfully', 'success');
    } catch (error) {
      console.error('Error saving marker:', error);
      showLocalToast('Failed to create marker', 'error');
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    // Clear preview when closing without saving
    if (onRadiusPreview) {
      onRadiusPreview(null, selectedType);
    }
    onClose();
  };

  const markerTypes: MarkerType[] = [
    'safe',
    'danger',
    'uncertain',
    'medical',
    'food',
    'shelter',
    'checkpoint',
    'combat',
  ];

  return (
    <Modal
      visible={visible}
      animationType={isDesktop ? "fade" : "slide"}
      transparent={true}
      onRequestClose={isSaving ? undefined : handleClose}
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
    >
      <View style={[styles.overlay, isDesktop && styles.overlayDesktop]}>
        <TouchableOpacity
          style={[styles.overlayTouchable]}
          activeOpacity={1}
          onPress={handleClose}
          disabled={isDraggingSlider || isSaving}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.keyboardView, isDesktop ? styles.keyboardViewDesktop : undefined]}
          keyboardVerticalOffset={0}
        >
          <View style={[
            styles.modal, 
            isDesktop && styles.modalDesktop,
            { opacity: isDraggingSlider ? 0.15 : 1 }
          ]}>
              {/* Header */}
              <View style={[styles.header, { opacity: isSaving ? 0.3 : 1 }]}>
                <Text style={styles.headerTitle}>Add Safety Marker</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton} disabled={isDraggingSlider || isSaving}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

          <ScrollView 
            style={[styles.content, { opacity: isSaving ? 0.3 : 1 }]} 
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            removeClippedSubviews={true}
            overScrollMode="never"
            scrollEnabled={!isSaving && !isDraggingSlider}
          >
            {/* Location Display */}
            <View style={styles.section}>
              <View style={styles.sectionLabelRow}>
                <Icon name="map-marker-alt" size={14} color="#333" />
                <Text style={styles.sectionLabel}>Location</Text>
              </View>
              <Text style={styles.coordinates}>
                {latitude.toFixed(4)}°N, {longitude.toFixed(4)}°E
              </Text>
            </View>

            {/* Marker Type Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Marker Type</Text>
              <View style={styles.typeGrid}>
                {markerTypes.map((type) => {
                  const config = MARKER_CONFIG[type];
                  const isSelected = selectedType === type;
                  
                  return (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        isSelected && {
                          backgroundColor: config.color + '20',
                          borderColor: config.color,
                          borderWidth: 2,
                        },
                      ]}
                      onPress={() => handleTypeChange(type)}
                    >
                      <View
                        style={[
                          styles.typeIcon,
                          { backgroundColor: config.color },
                        ]}
                      >
                        <MarkerIcon type={type} size={20} color="#fff" />
                      </View>
                      <Text style={styles.typeLabel}>{config.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Title Input */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Main Hospital, Checkpoint Alpha"
                placeholderTextColor="#999"
                value={title}
                onChangeText={setTitle}
                maxLength={50}
              />
            </View>

            {/* Description Input */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add details about this location..."
                placeholderTextColor="#999"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                maxLength={500}
                textAlignVertical="top"
              />
            </View>

            {/* Radius Input */}
            {radius > 0 && (
              <View style={styles.section}>
                <View style={styles.radiusHeader}>
                  <Text style={styles.sectionLabel}>Affected Area Radius</Text>
                  <View style={styles.radiusValueContainer}>
                    <TextInput
                      style={styles.radiusInput}
                      value={radiusText}
                      onChangeText={handleRadiusTextChange}
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                    <Text style={styles.radiusUnit}>meters</Text>
                  </View>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={MIN_RADIUS}
                  maximumValue={MAX_RADIUS}
                  step={10}
                  value={radius}
                  onValueChange={handleRadiusSliderChange}
                  onSlidingStart={handleSliderStart}
                  onSlidingComplete={handleSliderEnd}
                  minimumTrackTintColor={MARKER_CONFIG[selectedType].color}
                  maximumTrackTintColor="#ddd"
                  thumbTintColor={MARKER_CONFIG[selectedType].color}
                />
                <View style={styles.radiusLabels}>
                  <Text style={styles.radiusLabel}>{MIN_RADIUS}m</Text>
                  <Text style={styles.radiusLabel}>{MAX_RADIUS}m</Text>
                </View>
              </View>
            )}

            {/* Info Note */}
            <View style={styles.infoBox}>
              <Icon name="info-circle" size={16} color="#3B82F6" style={styles.infoIcon} />
              <Text style={styles.infoText}>
                Your marker will be visible to other SafePath users in this area.
                Other users can agree or disagree to verify accuracy.
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={[styles.actions, { opacity: isDraggingSlider || isSaving ? 0.3 : 1 }]}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={isDraggingSlider || isSaving}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: MARKER_CONFIG[selectedType].color },
                (isDraggingSlider || isSaving) && { opacity: 0.6 }
              ]}
              onPress={handleSave}
              disabled={isDraggingSlider || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Save Marker</Text>
              )}
            </TouchableOpacity>
          </View>
          </View>
        </KeyboardAvoidingView>
        
        {/* Local Toast for Modal */}
        <Toast
          visible={toastVisible}
          message={toastMessage}
          type={toastType}
          onHide={() => setToastVisible(false)}
        />
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
  keyboardView: {
    justifyContent: 'flex-end',
  } as const,
  keyboardViewDesktop: {
    justifyContent: 'center',
    alignItems: 'center',
  } as const,
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    boxShadow: '0px -2px 10px 0px rgba(0, 0, 0, 0.25)',
    elevation: 10,
    overflow: 'hidden',
  } as const,
  modalDesktop: {
    borderRadius: 20,
    maxWidth: 500,
    width: '100%',
    maxHeight: 600,
  } as const,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  } as const,
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  } as const,
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  } as const,
  content: {
    maxHeight: 500,
  } as const,
  contentContainer: {
    padding: 20,
  } as const,
  section: {
    marginBottom: 24,
  } as const,
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  } as const,
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  } as const,
  coordinates: {
    fontSize: 14,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  } as const,
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  } as const,
  typeButton: {
    width: '22%',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 90,
  } as const,
  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    overflow: 'hidden',
  } as const,
  typeLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 'auto',
  } as const,
  input: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  } as const,
  textArea: {
    height: 100,
    paddingTop: 12,
  } as const,
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
  } as const,
  infoIcon: {
    marginRight: 8,
    marginTop: 2,
  } as const,
  infoText: {
    fontSize: 13,
    color: '#1976D2',
    lineHeight: 18,
    flex: 1,
  } as const,
  actions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  } as const,
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  } as const,
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  } as const,
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  } as const,
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  } as const,
  radiusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  } as const,
  radiusValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  } as const,
  radiusInput: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    minWidth: 40,
    textAlign: 'right',
    padding: 0,
  } as const,
  radiusUnit: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
  } as const,
  slider: {
    width: '100%',
    height: 40,
  } as const,
  radiusLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
  } as const,
  radiusLabel: {
    fontSize: 11,
    color: '#999',
  } as const,
});
