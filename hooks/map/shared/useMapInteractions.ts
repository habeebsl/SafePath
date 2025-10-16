import { useCallback } from 'react';

interface UseMapInteractionsOptions {
  modals: {
    openAddMarker: (lat: number, lng: number) => void;
  };
}

export function useMapInteractions({ modals }: UseMapInteractionsOptions) {
  // Handler for map click/context menu
  const handleMapClick = useCallback((lat: number, lng: number) => {
    modals.openAddMarker(lat, lng);
  }, [modals]);

  return {
    handleMapClick,
  };
}