import { Tabs } from 'expo-router';

import { useAppMode } from '@/stores/app-mode';
import { useTheme } from '@/theme';

export default function AppTabsLayout() {
  const colors = useTheme();
  const mode = useAppMode((state) => state.mode);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: mode === 'driver' ? 'Find parking' : 'My spots' }}
      />
      <Tabs.Screen name="bookings" options={{ title: 'Bookings' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
