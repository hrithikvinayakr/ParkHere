import { formatPaise, toUserMessage, VEHICLE_TYPE_LABELS } from '@parkhere/shared';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import MapView, { Circle } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePublicSpot, type PublicSpot } from '@/api/spots';
import { Body, Button, Card, ErrorText, Title } from '@/components/ui';
import { formatAvailability } from '@/features/spots/spot-format';
import { fontSize, radius, spacing, useTheme } from '@/theme';

/** Radius of the "somewhere in here" circle; the public location is rounded to ~100 m. */
const APPROXIMATE_RADIUS_M = 150;

export default function ParkingSpotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: spot, error, isPending } = usePublicSpot(id);

  if (isPending) return <ActivityIndicator style={styles.loading} />;
  if (error || !spot) {
    return (
      <View style={styles.content}>
        <ErrorText>{toUserMessage(error)}</ErrorText>
      </View>
    );
  }
  return <SpotDetails spot={spot} />;
}

function SpotDetails({ spot }: { spot: PublicSpot }) {
  const router = useRouter();
  const colors = useTheme();

  const features = [
    spot.is_covered && 'Covered',
    spot.has_cctv && 'CCTV',
    spot.has_security_guard && 'Security guard',
    spot.has_ev_charging && 'EV charging',
    spot.max_height_cm && `Height limit ${spot.max_height_cm} cm`,
  ].filter(Boolean);

  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <PhotoGallery urls={spot.photoUrls} />

        <View style={styles.content}>
          <View>
            <Title>{spot.title}</Title>
            <Body muted>
              {[
                spot.area_label,
                spot.rating_count > 0
                  ? `★ ${spot.rating_avg} (${spot.rating_count} reviews)`
                  : 'New',
              ]
                .filter(Boolean)
                .join(' · ')}
            </Body>
            {spot.host_first_name ? <Body muted>Hosted by {spot.host_first_name}</Body> : null}
          </View>

          <Card>
            <Text style={[styles.price, { color: colors.text }]}>
              {formatPaise(spot.hourly_rate_paise)}
              <Text style={[styles.perHour, { color: colors.textMuted }]}> per hour</Text>
            </Text>
            <Body muted>
              {spot.instant_book
                ? '⚡ Instant book: confirmed straight away at this price'
                : 'The host approves each booking'}
            </Body>
            <Body muted>You can also offer a lower price; the host decides.</Body>
          </Card>

          <Card>
            <Body muted>Fits</Body>
            <Body>{spot.vehicle_types.map((type) => VEHICLE_TYPE_LABELS[type]).join(', ')}</Body>
            {features.length > 0 ? (
              <>
                <Body muted>Features</Body>
                <Body>{features.join(' · ')}</Body>
              </>
            ) : null}
          </Card>

          <Card>
            <Body muted>Opening hours</Body>
            <Body>{formatAvailability(spot.availability)}</Body>
          </Card>

          {spot.description ? (
            <Card>
              <Body muted>About this spot</Body>
              <Body>{spot.description}</Body>
            </Card>
          ) : null}

          <Card>
            <Body muted>Location</Body>
            <View style={[styles.mapFrame, { borderColor: colors.border }]}>
              <MapView
                style={StyleSheet.absoluteFill}
                liteMode
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
                initialRegion={{
                  latitude: spot.lat,
                  longitude: spot.lng,
                  latitudeDelta: 0.008,
                  longitudeDelta: 0.008,
                }}
              >
                <Circle
                  center={{ latitude: spot.lat, longitude: spot.lng }}
                  radius={APPROXIMATE_RADIUS_M}
                  strokeColor={colors.primary}
                  fillColor="rgba(37, 99, 235, 0.15)"
                />
              </MapView>
            </View>
            <Body muted>🔒 The exact address and entry details are shared after you book.</Body>
          </Card>
        </View>
      </ScrollView>

      <View
        style={[styles.footer, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        {spot.is_own ? (
          <Button
            label="This is your spot — manage it"
            variant="secondary"
            onPress={() => router.push({ pathname: '/spots/[id]', params: { id: spot.id } })}
          />
        ) : (
          <>
            <Button label="Book this spot" disabled onPress={() => undefined} />
            <Body muted>Booking arrives in the next update.</Body>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

function PhotoGallery({ urls }: { urls: string[] }) {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  if (urls.length === 0) {
    return (
      <View style={[styles.noPhoto, { width, backgroundColor: colors.border }]}>
        <Text style={styles.noPhotoIcon}>🅿️</Text>
        <Body muted>No photos yet</Body>
      </View>
    );
  }

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) =>
          setIndex(Math.round(event.nativeEvent.contentOffset.x / width))
        }
      >
        {urls.map((url) => (
          <Image
            key={url}
            source={{ uri: url }}
            style={[styles.photo, { width, backgroundColor: colors.border }]}
            contentFit="cover"
          />
        ))}
      </ScrollView>
      {urls.length > 1 ? (
        <View style={styles.counter}>
          <Text style={styles.counterText}>
            {index + 1} / {urls.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { marginTop: spacing.xxl },
  scroll: { paddingBottom: spacing.xl },
  content: { padding: spacing.lg, gap: spacing.md },
  photo: { height: 240 },
  noPhoto: { height: 160, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  noPhotoIcon: { fontSize: 36 },
  counter: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  counterText: { color: '#FFFFFF', fontSize: fontSize.sm },
  price: { fontSize: fontSize.xl, fontWeight: '700' },
  perHour: { fontSize: fontSize.md, fontWeight: '400' },
  mapFrame: { height: 160, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  footer: { padding: spacing.lg, gap: spacing.xs, borderTopWidth: 1 },
});
