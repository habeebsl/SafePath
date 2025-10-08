import { Tabs } from 'expo-router';
import React from 'react';

import { Icon } from '@/components/Icon';

export default function TabLayout() {

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Icon size={28} name="house" color={color} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: ({ color }) => <Icon size={28} name="map" color={color} />,
        }}
      />
    </Tabs>
  );
}
