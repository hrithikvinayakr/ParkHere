import {
  BOOKING_STATUS_LABELS,
  formatPaise,
  parseTimeRange,
  toUserMessage,
} from '@parkhere/shared';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { useBookingsRealtime, useMyBookings } from '@/api/bookings';
import { Body, Card, ErrorText, Screen, Title } from '@/components/ui';
import { useAppMode } from '@/stores/app-mode';
import { spacing } from '@/theme';

const dateTimeFormat = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

export default function BookingsScreen() {
  const mode = useAppMode((state) => state.mode);
  const { data, error, isPending, refetch, isRefetching } = useMyBookings(mode);
  useBookingsRealtime();

  return (
    <Screen>
      <FlatList
        data={data ?? []}
        keyExtractor={(booking) => booking.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }
        ListHeaderComponent={
          <View>
            <Title>{mode === 'driver' ? 'My bookings' : 'Bookings at my spots'}</Title>
            <ErrorText>{error ? toUserMessage(error) : null}</ErrorText>
          </View>
        }
        ListEmptyComponent={isPending ? <ActivityIndicator /> : <Body muted>No bookings yet.</Body>}
        renderItem={({ item }) => {
          const { start, end } = parseTimeRange(item.during);
          return (
            <Card>
              <Body>{item.spot?.title ?? 'Parking spot'}</Body>
              <Body muted>
                {dateTimeFormat.format(start)} – {dateTimeFormat.format(end)}
              </Body>
              <Body>
                {BOOKING_STATUS_LABELS[item.status]} · {formatPaise(item.total_paise)}
              </Body>
              {item.status === 'confirmed' ? (
                <Body muted>Check-in code: {item.checkin_code}</Body>
              ) : null}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, paddingBottom: spacing.xl },
});
