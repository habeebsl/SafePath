import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { AlertProvider } from '@/components/Alert';
import { DatabaseProvider } from '@/contexts/DatabaseContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { SOSProvider } from '@/contexts/SOSContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { TrailProvider } from '@/contexts/TrailContext';

export default function RootLayout() {
  const content = (
    <DatabaseProvider>
      <LocationProvider>
        <ToastProvider>
          <SOSProvider>
            <TrailProvider>
              <Stack>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
              </Stack>
              <StatusBar style="auto" />
            </TrailProvider>
          </SOSProvider>
        </ToastProvider>
      </LocationProvider>
    </DatabaseProvider>
  );

  // Wrap with AlertProvider on web only
  if (Platform.OS === 'web') {
    return <AlertProvider>{content}</AlertProvider>;
  }

  return content;
}
