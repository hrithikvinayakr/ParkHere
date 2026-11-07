import { formatPaise, toUserMessage } from '@parkhere/shared';
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

import { useMySpots } from '@/api/spots';
import { Body, Button, Card, ErrorText, Screen, Title } from '@/components/ui';
import { DriverMap } from '@/features/search/driver-map';
import { useAppMode } from '@/stores/app-mode';
import { radius, spacing, useTheme } from '@/theme';

export default function HomeScreen() {
  const mode = useAppMode((state) => state.mode);
  // The driver map is full-bleed; the host list uses the padded screen layout.
  if (mode === 'driver') return <DriverMap />;
  return (
    <Screen>
      <MySpots />
    </Screen>
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
