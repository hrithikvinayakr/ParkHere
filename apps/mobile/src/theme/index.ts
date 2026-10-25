import { useColorScheme } from 'react-native';

const palette = {
  light: {
    background: '#F7F8FA',
    surface: '#FFFFFF',
    text: '#111827',
    textMuted: '#6B7280',
    border: '#E5E7EB',
    primary: '#2563EB',
    primaryText: '#FFFFFF',
    danger: '#DC2626',
    success: '#16A34A',
  },
  dark: {
    background: '#0B0F17',
    surface: '#151B26',
    text: '#F3F4F6',
    textMuted: '#9CA3AF',
    border: '#273042',
    primary: '#3B82F6',
    primaryText: '#FFFFFF',
    danger: '#F87171',
    success: '#4ADE80',
  },
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const fontSize = { sm: 13, md: 15, lg: 18, xl: 24, xxl: 30 } as const;

export type ThemeColors = { [K in keyof (typeof palette)['light']]: string };

export function useTheme(): ThemeColors {
  return useColorScheme() === 'dark' ? palette.dark : palette.light;
}
