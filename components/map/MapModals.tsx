/**
 * Map modals - handles all marker and SOS modals
 */

import { AddMarkerModal } from '@/components/markers/AddMarkerModal';
import { MarkerDetailsModal } from '@/components/markers/MarkerDetailsModal';
import { SOSDetailsModal } from '@/components/sos/SOSDetailsModal';
import { Marker, MarkerType } from '@/types/marker';
import { SOSMarker } from '@/types/sos';
import React from 'react';

interface MapModalsProps {
  // Add Marker Modal
  showAddMarker: boolean;
  selectedLocation: { lat: number; lng: number } | null;
  onCloseAddMarker: () => void;
  onSaveMarker: (data: {
    type: MarkerType;
    title: string;
    description: string;
    latitude: number;
    longitude: number;
  }) => void;

  // Marker Details Modal
  showMarkerDetails: boolean;
  selectedMarker: Marker | null;
  onCloseMarkerDetails: () => void;
  onVote: (vote: 'agree' | 'disagree') => void;

  // SOS Details Modal
  showSOSDetails: boolean;
  selectedSOSMarker: SOSMarker | null;
  onCloseSOSDetails: () => void;
}

export function MapModals({
  showAddMarker,
  selectedLocation,
  onCloseAddMarker,
  onSaveMarker,
  showMarkerDetails,
  selectedMarker,
  onCloseMarkerDetails,
  onVote,
  showSOSDetails,
  selectedSOSMarker,
  onCloseSOSDetails,
}: MapModalsProps) {
  return (
    <>
      {/* Add Marker Modal */}
      {selectedLocation && (
        <AddMarkerModal
          visible={showAddMarker}
          latitude={selectedLocation.lat}
          longitude={selectedLocation.lng}
          onClose={onCloseAddMarker}
          onSave={onSaveMarker}
        />
      )}

      {/* Marker Details Modal */}
      <MarkerDetailsModal
        visible={showMarkerDetails}
        marker={selectedMarker}
        userVote={null}
        onClose={onCloseMarkerDetails}
        onVote={onVote}
      />

      {/* SOS Details Modal */}
      <SOSDetailsModal
        visible={showSOSDetails}
        sosMarker={selectedSOSMarker}
        onClose={onCloseSOSDetails}
      />
    </>
  );
}
