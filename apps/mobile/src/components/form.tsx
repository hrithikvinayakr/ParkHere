import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { fontSize, radius, spacing, useTheme } from '@/theme';

export function SectionTitle({ children }: PropsWithChildren) {
  const colors = useTheme();
  return <Text style={[styles.section, { color: colors.text }]}>{children}</Text>;
}

export function FieldError({ message }: { message?: string }) {
  const colors = useTheme();
  if (!message) return null;
  return (
    <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>
      {message}
    </Text>
  );
}

type ChipProps = { label: string; selected: boolean; onPress: () => void };

export function Chip({ label, selected, onPress }: ChipProps) {
  const colors = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text style={[styles.chipLabel, { color: selected ? colors.primaryText : colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipRow({ children }: PropsWithChildren) {
  return <View style={styles.chipRow}>{children}</View>;
}

type SwitchRowProps = {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export function SwitchRow({ label, description, value, onValueChange }: SwitchRowProps) {
  const colors = useTheme();
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchText}>
        <Text style={[styles.switchLabel, { color: colors.text }]}>{label}</Text>
        {description ? (
          <Text style={[styles.switchDescription, { color: colors.textMuted }]}>{description}</Text>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.primary, false: colors.border }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: fontSize.lg, fontWeight: '700', marginTop: spacing.lg },
  error: { fontSize: fontSize.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipLabel: { fontSize: fontSize.md, fontWeight: '500' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 48,
  },
  switchText: { flex: 1 },
  switchLabel: { fontSize: fontSize.md },
  switchDescription: { fontSize: fontSize.sm },
});
