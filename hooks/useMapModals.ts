/**
 * Custom hook for managing map modal states
 */

import { Marker } from '@/types/marker';
import { SOSMarker } from '@/types/sos';
import { useState } from 'react';

export function useMapModals() {
  // Marker modal state
  const [showAddMarker, setShowAddMarker] = useState(false);
  const [showMarkerDetails, setShowMarkerDetails] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null);
  
  // SOS modal state
  const [showSOSDetails, setShowSOSDetails] = useState(false);
  const [selectedSOSMarker, setSelectedSOSMarker] = useState<SOSMarker | null>(null);

  const openAddMarker = (lat: number, lng: number) => {
    setSelectedLocation({ lat, lng });
    setShowAddMarker(true);
  };

  const closeAddMarker = () => {
    setShowAddMarker(false);
    setSelectedLocation(null);
  };

  const openMarkerDetails = (marker: Marker) => {
    setSelectedMarker(marker);
    setShowMarkerDetails(true);
  };

  const closeMarkerDetails = () => {
    setShowMarkerDetails(false);
    setSelectedMarker(null);
  };

  const openSOSDetails = (sosMarker: SOSMarker) => {
    setSelectedSOSMarker(sosMarker);
    setShowSOSDetails(true);
  };

  const closeSOSDetails = () => {
    setShowSOSDetails(false);
    setSelectedSOSMarker(null);
  };

  return {
    // Add Marker Modal
    showAddMarker,
    selectedLocation,
    openAddMarker,
    closeAddMarker,

    // Marker Details Modal
    showMarkerDetails,
    selectedMarker,
    openMarkerDetails,
    closeMarkerDetails,

    // SOS Details Modal
    showSOSDetails,
    selectedSOSMarker,
    openSOSDetails,
    closeSOSDetails,
  };
}
