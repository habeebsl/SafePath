/**
 * Custom hook for monitoring network connectivity
 */

import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
    });

    // Get initial network state
    NetInfo.fetch().then(state => {
      setIsOnline(state.isConnected === true && state.isInternetReachable !== false);
    });

    return () => unsubscribe();
  }, []);

  return isOnline;
}
