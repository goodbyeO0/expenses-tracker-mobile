import { Tabs, Redirect } from 'expo-router';
import React, { useContext } from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthContext } from '../_layout';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user, initializing } = useContext(AuthContext);

  // If still initializing, show nothing
  if (initializing) {
    return null;
  }

  // If not authenticated, redirect to auth
  if (!user) {
    return <Redirect href="/auth" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#4285F4',
        tabBarInactiveTintColor: '#999',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e1e5e9',
          height: Platform.OS === 'ios' ? 88 : 68,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={24}
              name={focused ? "house.fill" : "house"}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="ocr"
        options={{
          title: 'Scan Receipt',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={24}
              name={focused ? "camera.fill" : "camera"}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={24}
              name={focused ? "paperplane.fill" : "chevron.right"}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <IconSymbol
              size={24}
              name={focused ? "person.fill" : "person"}
              color={color}
            />
          ),
        }}
      />
      {/* Hide unnecessary tabs */}
      <Tabs.Screen
        name="explore"
        options={{
          href: null, // This hides the tab
        }}
      />
      <Tabs.Screen
        name="notification"
        options={{
          href: null, // This hides the tab
        }}
      />
    </Tabs>
  );
}
