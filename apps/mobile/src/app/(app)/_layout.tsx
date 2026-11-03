import { Stack } from 'expo-router';

import { useTheme } from '@/theme';

export default function AppStackLayout() {
  const colors = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="spots/new" options={{ title: 'List a spot' }} />
      <Stack.Screen name="spots/[id]" options={{ title: 'Manage spot' }} />
      <Stack.Screen name="spots/[id]/edit" options={{ title: 'Edit spot' }} />
    </Stack>
  );
}
