import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { AlertProvider } from '@/components/Alert';
import { DatabaseProvider } from '@/contexts/DatabaseContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { SOSProvider } from '@/contexts/SOSContext';
import { TrailProvider } from '@/contexts/TrailContext';

export default function RootLayout() {
  const content = (
    <DatabaseProvider>
      <LocationProvider>
        <SOSProvider>
          <TrailProvider>
            <Stack>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
            <StatusBar style="auto" />
          </TrailProvider>
        </SOSProvider>
      </LocationProvider>
    </DatabaseProvider>
  );

  // Wrap with AlertProvider on web only
  if (Platform.OS === 'web') {
    return <AlertProvider>{content}</AlertProvider>;
  }

  return content;
}
