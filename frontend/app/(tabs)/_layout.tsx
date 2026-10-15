// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import React from 'react';
import { View, Platform, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { MotiView } from 'moti';
import { usePushNotifications } from '../../hooks/usePushNotifications';

// --- Minimal palette ---
const COLORS = {
  ink: '#111318',
  muted: '#B7BCC4',
  bg: '#FFFFFF',
  line: '#F1F2F4',
};

// Icon just changes weight/color on focus — no bounce, no boxes
const TabIcon = ({ name, focused }: { name: any; focused: boolean }) => (
  <View style={{ alignItems: 'center' }}>
    <Feather name={name} size={22} color={focused ? COLORS.ink : COLORS.muted} />
    <MotiView
      animate={{ opacity: focused ? 1 : 0, scale: focused ? 1 : 0.5 }}
      transition={{ type: 'timing', duration: 200 }}
      style={styles.dot}
    />
  </View>
);

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  usePushNotifications();

  return (
    <Tabs
      screenListeners={{
        tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
      }}
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: COLORS.ink,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500', marginTop: -5 },
        tabBarStyle: {
          backgroundColor: COLORS.bg,
          borderTopWidth: 1,
          borderTopColor: COLORS.line,
          height: Platform.OS === 'ios' ? 70 + insets.bottom : 90,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 20,
          paddingTop: 10,
          elevation: 0,
          shadowOpacity: 0,
        },
      }}
    >
      <Tabs.Screen name="records" options={{ tabBarLabel: 'Records', tabBarIcon: ({ focused }) => <TabIcon name="list" focused={focused} /> }} />
      <Tabs.Screen name="add" options={{ tabBarLabel: 'Add', tabBarIcon: ({ focused }) => <TabIcon name="plus" focused={focused} /> }} />
      <Tabs.Screen name="coach" options={{ tabBarLabel: 'Coach', tabBarIcon: ({ focused }) => <TabIcon name="message-circle" focused={focused} /> }} />
      <Tabs.Screen name="charts" options={{ tabBarLabel: 'Charts', tabBarIcon: ({ focused }) => <TabIcon name="pie-chart" focused={focused} /> }} />
      <Tabs.Screen name="reports" options={{ tabBarLabel: 'Reports', tabBarIcon: ({ focused }) => <TabIcon name="file-text" focused={focused} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.ink,
    marginTop: 5,
  },
});