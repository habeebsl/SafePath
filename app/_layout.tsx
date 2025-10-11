import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { DatabaseProvider } from '@/contexts/DatabaseContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { SOSProvider } from '@/contexts/SOSContext';
import { TrailProvider } from '@/contexts/TrailContext';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <DatabaseProvider>
      <LocationProvider>
        <SOSProvider>
          <TrailProvider>
            <Stack>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
            <StatusBar style="auto" />
          </TrailProvider>
        </SOSProvider>
      </LocationProvider>
    </DatabaseProvider>
  );
}
