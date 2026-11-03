import {
  formatPaise,
  toUserMessage,
  VEHICLE_TYPE_LABELS,
  type Coordinates,
} from '@parkhere/shared';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';

import { useMySpots, useNearbySpots } from '@/api/spots';
import { Body, Button, Card, ErrorText, Screen, Title } from '@/components/ui';
import { useAppMode } from '@/stores/app-mode';
import { radius, spacing, useTheme } from '@/theme';

// Placeholder search centre (MG Road, Bengaluru) until device location and the
// map screen are added in the "Driver search and map" milestone.
const DEFAULT_CENTER: Coordinates = { lat: 12.9716, lng: 77.5946 };

export default function HomeScreen() {
  const mode = useAppMode((state) => state.mode);
  return <Screen>{mode === 'driver' ? <NearbySpots /> : <MySpots />}</Screen>;
}

function NearbySpots() {
  const { data, error, isPending, refetch, isRefetching } = useNearbySpots(DEFAULT_CENTER);

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(spot) => spot.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
      ListHeaderComponent={
        <View>
          <Title>Parking near you</Title>
          <ErrorText>{error ? toUserMessage(error) : null}</ErrorText>
        </View>
      }
      ListEmptyComponent={
        isPending ? <ActivityIndicator /> : <Body muted>No spots nearby right now.</Body>
      }
      renderItem={({ item }) => (
        <Card>
          <Body>{item.title}</Body>
          <Body muted>
            {item.area_label} · {(item.distance_m / 1000).toFixed(1)} km away
          </Body>
          <Body>
            {formatPaise(item.hourly_rate_paise)}/hr ·{' '}
            {item.instant_book ? 'Instant book' : 'Offers'}
            {' · '}
            {item.vehicle_types.map((type) => VEHICLE_TYPE_LABELS[type]).join(', ')}
          </Body>
        </Card>
      )}
    />
  );
}

const SPOT_STATUS_LABELS = {
  active: 'Live',
  paused: 'Paused',
  draft: 'Draft',
  suspended: 'Suspended',
};

function MySpots() {
  const router = useRouter();
  const colors = useTheme();
  const { data, error, isPending, refetch, isRefetching } = useMySpots();

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(spot) => spot.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Title>My spots</Title>
          <ErrorText>{error ? toUserMessage(error) : null}</ErrorText>
          <Button label="List a spot" onPress={() => router.push('/spots/new')} />
        </View>
      }
      ListEmptyComponent={
        isPending ? (
          <ActivityIndicator />
        ) : (
          <Body muted>
            You haven&apos;t listed a spot yet. List your driveway, garage or lot to start earning.
          </Body>
        )
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/spots/[id]', params: { id: item.id } })}
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <Card>
            <View style={styles.spotRow}>
              {item.coverUrl ? (
                <Image
                  source={{ uri: item.coverUrl }}
                  style={[styles.thumb, { backgroundColor: colors.border }]}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.thumb, { backgroundColor: colors.border }]} />
              )}
              <View style={styles.spotText}>
                <Body>{item.title}</Body>
                <Body muted>
                  {SPOT_STATUS_LABELS[item.status]} · {formatPaise(item.hourly_rate_paise)}/hr
                  {item.rating_avg !== null ? ` · ★ ${item.rating_avg} (${item.rating_count})` : ''}
                </Body>
              </View>
            </View>
          </Card>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, paddingBottom: spacing.xl },
  header: { gap: spacing.sm },
  spotRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  thumb: { width: 64, height: 64, borderRadius: radius.md },
  spotText: { flex: 1, gap: spacing.xs },
});
