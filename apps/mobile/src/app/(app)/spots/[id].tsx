import { formatPaise, toUserMessage, VEHICLE_TYPE_LABELS } from '@parkhere/shared';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useDeleteSpot, useMySpot, useSetSpotStatus, type MySpot } from '@/api/spots';
import { Body, Button, Card, ErrorText, Title } from '@/components/ui';
import { formatAvailability } from '@/features/spots/spot-format';
import { fontSize, radius, spacing, useTheme } from '@/theme';

export default function ManageSpotScreen() {
  const { id, photosFailed } = useLocalSearchParams<{ id: string; photosFailed?: string }>();
  const { data: spot, error, isPending } = useMySpot(id);

  if (isPending) return <ActivityIndicator style={styles.loading} />;
  if (error || !spot) {
    return (
      <View style={styles.content}>
        <ErrorText>{toUserMessage(error)}</ErrorText>
      </View>
    );
  }
  return <SpotDetails spot={spot} photosFailed={photosFailed === '1'} />;
}

function SpotDetails({ spot, photosFailed }: { spot: MySpot; photosFailed: boolean }) {
  const router = useRouter();
  const colors = useTheme();
  const setStatus = useSetSpotStatus(spot.id);
  const deleteSpot = useDeleteSpot(spot);
  const isActive = spot.status === 'active';

  const features = [
    spot.is_covered && 'Covered',
    spot.has_cctv && 'CCTV',
    spot.has_security_guard && 'Security guard',
    spot.has_ev_charging && 'EV charging',
    spot.max_height_cm && `Height limit ${spot.max_height_cm} cm`,
  ].filter(Boolean);

  function confirmDelete() {
    Alert.alert('Delete this spot?', 'This removes the listing and its photos.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteSpot.mutate(undefined, { onSuccess: () => router.back() }),
      },
    ]);
  }

  const actionError = setStatus.error ?? deleteSpot.error;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {photosFailed ? (
        <ErrorText>
          Your spot is live, but some photos failed to upload. Use Edit to retry.
        </ErrorText>
      ) : null}

      {spot.photos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photos}
        >
          {spot.photos.map((photo) =>
            photo.kind === 'remote' ? (
              <Image
                key={photo.id}
                source={{ uri: photo.url }}
                style={[styles.photo, { backgroundColor: colors.border }]}
                contentFit="cover"
              />
            ) : null,
          )}
        </ScrollView>
      ) : (
        <Body muted>No photos yet. Spots with photos get more bookings.</Body>
      )}

      <View>
        <Title>{spot.title}</Title>
        <View
          style={[styles.badge, { backgroundColor: isActive ? colors.success : colors.textMuted }]}
        >
          <Text style={styles.badgeText}>
            {isActive ? 'Live' : spot.status === 'paused' ? 'Paused' : spot.status}
          </Text>
        </View>
      </View>

      <Card>
        <Body>
          {formatPaise(spot.hourly_rate_paise)}/hr ·{' '}
          {spot.instant_book ? 'Instant book' : 'You approve bookings'}
        </Body>
        <Body muted>{spot.vehicle_types.map((type) => VEHICLE_TYPE_LABELS[type]).join(', ')}</Body>
        {features.length > 0 ? <Body muted>{features.join(' · ')}</Body> : null}
        {spot.rating_count > 0 ? (
          <Body muted>
            ★ {spot.rating_avg} ({spot.rating_count} reviews)
          </Body>
        ) : null}
      </Card>

      <Card>
        <Body muted>Address (only shown to drivers after booking)</Body>
        <Body>{spot.address}</Body>
        {spot.area_label ? <Body muted>Shown in search as: {spot.area_label}</Body> : null}
        {spot.access_instructions ? <Body muted>Entry: {spot.access_instructions}</Body> : null}
      </Card>

      <Card>
        <Body muted>Opening hours</Body>
        <Body>{formatAvailability(spot.availability)}</Body>
      </Card>

      {spot.description ? (
        <Card>
          <Body muted>Description</Body>
          <Body>{spot.description}</Body>
        </Card>
      ) : null}

      <View style={styles.actions}>
        <ErrorText>{actionError ? toUserMessage(actionError) : null}</ErrorText>
        {spot.status === 'suspended' ? (
          <Body muted>This spot was suspended by ParkHere and can&apos;t be edited.</Body>
        ) : (
          <Button
            label="Edit"
            onPress={() => router.push({ pathname: '/spots/[id]/edit', params: { id: spot.id } })}
          />
        )}
        {spot.status === 'suspended' ? null : (
          <Button
            label={isActive ? 'Pause listing' : 'Publish listing'}
            variant="secondary"
            loading={setStatus.isPending}
            onPress={() => setStatus.mutate(isActive ? 'paused' : 'active')}
          />
        )}
        <Button
          label="Delete spot"
          variant="secondary"
          loading={deleteSpot.isPending}
          onPress={confirmDelete}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: spacing.xxl },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl * 2 },
  photos: { gap: spacing.sm },
  photo: { width: 220, height: 150, borderRadius: radius.lg },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: { color: '#FFFFFF', fontSize: fontSize.sm, fontWeight: '600' },
  actions: { gap: spacing.sm, marginTop: spacing.md },
});
