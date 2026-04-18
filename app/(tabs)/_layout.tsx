import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { AppFonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: 'rgba(63, 77, 103, 0.86)',
        tabBarInactiveTintColor: '#AAB2C0',
        headerShown: false,
        animation: 'fade',
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: colorScheme === 'dark' ? '#1A1C2E' : '#FFFFFF',
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          height: 88,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          fontFamily: AppFonts.medium,
          letterSpacing: 0.3,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: '時間割',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="assignment" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="memo"
        options={{
          title: 'メモ',
          tabBarIcon: ({ color }) =>(
            <MaterialIcons name="note-add" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="settings" size={26} color={color} />
          )
        }}
      />
    </Tabs>
  );
}
