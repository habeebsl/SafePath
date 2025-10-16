import { handleSaveMarker } from '@/utils/map-handlers';
import { useCallback } from 'react';

interface UseMapActionsOptions {
  deviceId: string | null;
  dbReady: boolean;
  dbAddMarker: (marker: any) => Promise<void>;
  modals: {
    closeAddMarker: () => void;
    closeMarkerDetails: () => void;
  };
}

export function useMapActions({ deviceId, dbReady, dbAddMarker, modals }: UseMapActionsOptions) {
  // Save marker handler
  const onSaveMarker = useCallback(async (data: any) => {
    // You can add your own validation here if needed
    try {
      await handleSaveMarker({
        data,
        deviceId,
        dbReady,
        dbAddMarker,
        onSuccess: () => {
          modals.closeAddMarker();
        },
      });
    } catch (error) {
      // Handle error (show alert, etc.)
    }
  }, [dbAddMarker, modals]);

  // Vote handler
  const onVote = useCallback((vote: 'agree' | 'disagree') => {
    // Voting is handled by context/modal, just close details
    modals.closeMarkerDetails();
  }, [modals]);

  return {
    onSaveMarker,
    onVote,
  };
}