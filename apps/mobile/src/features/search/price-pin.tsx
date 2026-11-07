import { formatPaise } from '@parkhere/shared';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { fontSize, radius, spacing, useTheme } from '@/theme';

type Props = {
  latitude: number;
  longitude: number;
  ratePaise: number;
  selected: boolean;
  onPress: () => void;
};

/** A map marker showing the hourly price, highlighted when selected. */
export function PricePin({ latitude, longitude, ratePaise, selected, onPress }: Props) {
  const colors = useTheme();
  return (
    <Marker
      coordinate={{ latitude, longitude }}
      onPress={onPress}
      // Custom views are rasterised once; the parent re-mounts the pin when `selected` changes.
      tracksViewChanges={false}
      zIndex={selected ? 2 : 1}
    >
      <View
        style={[
          styles.pin,
          {
            backgroundColor: selected ? colors.primary : colors.surface,
            borderColor: selected ? colors.primary : colors.border,
          },
        ]}
      >
        <Text style={[styles.label, { color: selected ? colors.primaryText : colors.text }]}>
          {formatPaise(ratePaise)}
        </Text>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  pin: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  label: { fontSize: fontSize.sm, fontWeight: '700' },
});
