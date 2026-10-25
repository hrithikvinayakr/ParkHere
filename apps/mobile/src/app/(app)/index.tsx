import {
  formatPaise,
  toUserMessage,
  VEHICLE_TYPE_LABELS,
  type Coordinates,
} from '@parkhere/shared';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { useMySpots, useNearbySpots } from '@/api/spots';
import { Body, Card, ErrorText, Screen, Title } from '@/components/ui';
import { useAppMode } from '@/stores/app-mode';
import { spacing } from '@/theme';

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

function MySpots() {
  const { data, error, isPending, refetch, isRefetching } = useMySpots();

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(spot) => spot.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
      ListHeaderComponent={
        <View>
          <Title>My spots</Title>
          <ErrorText>{error ? toUserMessage(error) : null}</ErrorText>
        </View>
      }
      ListEmptyComponent={
        isPending ? <ActivityIndicator /> : <Body muted>You haven&apos;t listed a spot yet.</Body>
      }
      renderItem={({ item }) => (
        <Card>
          <Body>{item.title}</Body>
          <Body muted>
            {item.status} · {formatPaise(item.hourly_rate_paise)}/hr
            {item.rating_avg !== null ? ` · ★ ${item.rating_avg} (${item.rating_count})` : ''}
          </Body>
        </Card>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, paddingBottom: spacing.xl },
});
