import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { AppFonts } from '@/constants/theme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#7C3AED',
        tabBarInactiveTintColor: '#94A3B8',
        headerShown: false,
        animation: 'fade',
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: 'rgba(255, 255, 255, 0.94)',
          borderTopWidth: 1,
          borderTopColor: '#EDE9FE',
          elevation: 8,
          shadowColor: '#7C3AED',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.12,
          shadowRadius: 10,
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
