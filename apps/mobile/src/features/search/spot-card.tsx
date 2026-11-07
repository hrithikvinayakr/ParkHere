import { formatDistance, formatPaise } from '@parkhere/shared';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { NearbySpot } from '@/api/spots';
import { fontSize, radius, spacing, useTheme } from '@/theme';

type Props = {
  spot: NearbySpot;
  /** Metres from the user (or from the map centre when the user's location is unknown). */
  distanceM: number;
  onPress: () => void;
};

export function SpotCard({ spot, distanceM, onPress }: Props) {
  const colors = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${spot.title}, ${formatPaise(spot.hourly_rate_paise)} per hour`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {spot.coverUrl ? (
        <Image source={{ uri: spot.coverUrl }} style={styles.photo} contentFit="cover" />
      ) : (
        <View style={[styles.photo, styles.noPhoto, { backgroundColor: colors.border }]}>
          <Text style={styles.noPhotoIcon}>🅿️</Text>
        </View>
      )}
      <View style={styles.text}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>
          {spot.title}
        </Text>
        <Text numberOfLines={1} style={[styles.meta, { color: colors.textMuted }]}>
          {[formatDistance(distanceM), spot.area_label].filter(Boolean).join(' · ')}
        </Text>
        <View style={styles.row}>
          <Text style={[styles.price, { color: colors.text }]}>
            {formatPaise(spot.hourly_rate_paise)}
            <Text style={[styles.meta, { color: colors.textMuted }]}>/hr</Text>
          </Text>
          {spot.rating_count > 0 ? (
            <Text style={[styles.meta, { color: colors.textMuted }]}>
              ★ {spot.rating_avg} ({spot.rating_count})
            </Text>
          ) : null}
          {spot.instant_book ? (
            <Text style={[styles.badge, { color: colors.success }]}>⚡ Instant</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  photo: { width: 84, height: 84, borderRadius: radius.md },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  noPhotoIcon: { fontSize: 28 },
  text: { flex: 1, justifyContent: 'center', gap: 2 },
  title: { fontSize: fontSize.md, fontWeight: '600' },
  meta: { fontSize: fontSize.sm, fontWeight: '400' },
  row: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flexWrap: 'wrap' },
  price: { fontSize: fontSize.lg, fontWeight: '700' },
  badge: { fontSize: fontSize.sm, fontWeight: '600' },
});
