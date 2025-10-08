import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MarkerType } from '@/types/marker';
import { MARKER_CONFIG } from '@/constants/marker-icons';
import { MarkerIcon } from './MarkerIcon';
import { Icon } from '@/components/Icon';

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
  }) => void;
}

export function AddMarkerModal({
  visible,
  latitude,
  longitude,
  onClose,
  onSave,
}: AddMarkerModalProps) {
  const [selectedType, setSelectedType] = useState<MarkerType>('danger');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = () => {
    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }

    onSave({
      type: selectedType,
      title: title.trim(),
      description: description.trim(),
      latitude,
      longitude,
    });

    // Reset form
    setTitle('');
    setDescription('');
    setSelectedType('danger');
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
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
          keyboardVerticalOffset={0}
        >
          <View style={styles.modal}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Add Safety Marker</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

          <ScrollView 
            style={styles.content} 
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            removeClippedSubviews={true}
            overScrollMode="never"
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
                      onPress={() => setSelectedType(type)}
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
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.saveButton,
                { backgroundColor: MARKER_CONFIG[selectedType].color },
              ]}
              onPress={handleSave}
            >
              <Text style={styles.saveButtonText}>Save Marker</Text>
            </TouchableOpacity>
          </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  keyboardView: {
    justifyContent: 'flex-end',
  },
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
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
  },
  section: {
    marginBottom: 24,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  coordinates: {
    fontSize: 14,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
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
  },
  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    overflow: 'hidden',
  },
  typeLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 'auto',
  },
  input: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  infoText: {
    fontSize: 13,
    color: '#1976D2',
    lineHeight: 18,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  saveButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
