import {
  distanceMeters,
  SEARCH_DEFAULT_RADIUS_M,
  SEARCH_MAX_RADIUS_M,
  toUserMessage,
  VEHICLE_TYPE_LABELS,
  type Coordinates,
  type VehicleType,
} from '@parkhere/shared';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNearbySpots, type NearbySpot, type SearchArea } from '@/api/spots';
import { Chip } from '@/components/form';
import {
  applyFilters,
  hasActiveFilters,
  NO_FILTERS,
  type SearchFilters,
} from '@/features/search/filters';
import { PricePin } from '@/features/search/price-pin';
import { SpotCard } from '@/features/search/spot-card';
import { fontSize, radius, spacing, useTheme } from '@/theme';

// MG Road, Bengaluru: shown until the device location is known.
const FALLBACK: Coordinates = { lat: 12.9716, lng: 77.5946 };
const CITY_ZOOM = { latitudeDelta: 0.03, longitudeDelta: 0.03 };
const VEHICLE_TYPES = Object.keys(VEHICLE_TYPE_LABELS) as VehicleType[];
const CHEAP_RATE_PAISE = 5000;

/**
 * Turns the visible map region into a search circle. Coordinates are rounded
 * (~100 m) and the radius snapped to 250 m so small pans reuse cached results.
 */
function areaFromRegion(region: Region): SearchArea {
  const spanM = Math.max(region.latitudeDelta, region.longitudeDelta) * 111_000;
  const radiusM = Math.min(SEARCH_MAX_RADIUS_M, Math.max(500, Math.round(spanM / 2 / 250) * 250));
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return { center: { lat: round(region.latitude), lng: round(region.longitude) }, radiusM };
}

/**
 * Reports the device position through `onFix`: a cached fix first (instant), then a
 * fresh one. Resolves to a message for the user when the location can't be found.
 */
async function findDeviceLocation(onFix: (here: Coordinates) => void): Promise<string | null> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) {
    return 'Location is off, so the map starts in central Bengaluru. Search for a place instead.';
  }
  const last = await Location.getLastKnownPositionAsync();
  if (last) onFix({ lat: last.coords.latitude, lng: last.coords.longitude });
  try {
    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    onFix({ lat: current.coords.latitude, lng: current.coords.longitude });
    return null;
  } catch {
    return last ? null : "Couldn't find your location. Search for a place instead.";
  }
}

export function DriverMap() {
  const router = useRouter();
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const [area, setArea] = useState<SearchArea>({
    center: FALLBACK,
    radiusM: SEARCH_DEFAULT_RADIUS_M,
  });
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [filters, setFilters] = useState<SearchFilters>(NO_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const { data, error, isFetching } = useNearbySpots(area, filters.vehicleType);
  const spots = useMemo(() => applyFilters(data ?? [], filters), [data, filters]);
  const selected = spots.find((spot) => spot.id === selectedId) ?? null;

  function moveTo(target: Coordinates, zoom = { latitudeDelta: 0.015, longitudeDelta: 0.015 }) {
    mapRef.current?.animateToRegion({ latitude: target.lat, longitude: target.lng, ...zoom }, 500);
  }

  // Centre the map on the first fix of each lookup; later fixes only refine the blue dot.
  const centredOnFix = useRef(false);

  function handleFix(here: Coordinates) {
    setUserLocation(here);
    if (!centredOnFix.current) {
      centredOnFix.current = true;
      moveTo(here);
    }
  }

  function locateMe() {
    centredOnFix.current = false;
    void findDeviceLocation(handleFix).then((problem) => {
      if (problem) setNotice(problem);
    });
  }

  useEffect(() => {
    void findDeviceLocation(handleFix).then((problem) => {
      if (problem) setNotice(problem);
    });
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function searchPlace() {
    const text = query.trim();
    if (!text) return;
    setNotice(null);
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        setNotice('Place search needs location permission on Android.');
        return;
      }
      const [place] = await Location.geocodeAsync(text);
      if (!place) {
        setNotice(`Couldn't find "${text}". Try adding the city name.`);
        return;
      }
      setSelectedId(null);
      setShowList(false);
      moveTo({ lat: place.latitude, lng: place.longitude });
    } catch {
      setNotice(`Couldn't search for "${text}" right now.`);
    }
  }

  function distanceTo(spot: NearbySpot): number {
    return userLocation
      ? distanceMeters(userLocation, { lat: spot.lat, lng: spot.lng })
      : spot.distance_m;
  }

  function openSpot(spot: NearbySpot) {
    router.push({ pathname: '/parking/[id]', params: { id: spot.id } });
  }

  const toggle = <K extends keyof SearchFilters>(
    key: K,
    on: SearchFilters[K],
    off: SearchFilters[K],
  ) => setFilters((current) => ({ ...current, [key]: current[key] === on ? off : on }));

  return (
    <View style={styles.flex}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: FALLBACK.lat, longitude: FALLBACK.lng, ...CITY_ZOOM }}
        onRegionChangeComplete={(region) => setArea(areaFromRegion(region))}
        onPress={(event) => {
          // Marker taps also reach the map on some platforms; ignore those.
          if (event.nativeEvent.action !== 'marker-press') setSelectedId(null);
        }}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {spots.map((spot) => (
          <PricePin
            key={`${spot.id}:${spot.id === selectedId}`}
            latitude={spot.lat}
            longitude={spot.lng}
            ratePaise={spot.hourly_rate_paise}
            selected={spot.id === selectedId}
            onPress={() => setSelectedId(spot.id)}
          />
        ))}
      </MapView>

      {/* Search bar and filters */}
      <View style={[styles.top, { paddingTop: insets.top + spacing.sm }]} pointerEvents="box-none">
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <TextInput
            accessibilityLabel="Search for a place"
            placeholder="Search area, landmark or address"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={searchPlace}
            returnKeyType="search"
            style={[styles.searchInput, { color: colors.text }]}
          />
          {isFetching ? <ActivityIndicator style={styles.spinner} /> : null}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          keyboardShouldPersistTaps="handled"
        >
          {VEHICLE_TYPES.map((type) => (
            <Chip
              key={type}
              label={VEHICLE_TYPE_LABELS[type]}
              selected={filters.vehicleType === type}
              onPress={() => toggle('vehicleType', type, null)}
            />
          ))}
          <Chip
            label="Covered"
            selected={filters.coveredOnly}
            onPress={() => toggle('coveredOnly', true, false)}
          />
          <Chip
            label="EV charging"
            selected={filters.evOnly}
            onPress={() => toggle('evOnly', true, false)}
          />
          <Chip
            label="Under ₹50/hr"
            selected={filters.maxRatePaise === CHEAP_RATE_PAISE}
            onPress={() => toggle('maxRatePaise', CHEAP_RATE_PAISE, null)}
          />
        </ScrollView>
        {notice || error ? (
          <Pressable
            onPress={() => setNotice(null)}
            style={[styles.notice, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={{ color: error ? colors.danger : colors.text }}>
              {error ? toUserMessage(error) : notice}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {showList ? (
        <View
          style={[
            styles.listOverlay,
            { backgroundColor: colors.background, top: insets.top + 120 },
          ]}
        >
          <FlatList
            data={spots}
            keyExtractor={(spot) => spot.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={{ color: colors.textMuted }}>
                No spots match in this area. Move the map or clear filters.
              </Text>
            }
            renderItem={({ item }) => (
              <SpotCard spot={item} distanceM={distanceTo(item)} onPress={() => openSpot(item)} />
            )}
          />
        </View>
      ) : null}

      {/* Bottom: selected spot, or result count with list toggle */}
      <View style={[styles.bottom, { paddingBottom: spacing.md }]} pointerEvents="box-none">
        <View style={styles.bottomButtons} pointerEvents="box-none">
          <RoundButton
            label={showList ? '🗺️ Map' : `☰ List (${spots.length})`}
            onPress={() => setShowList((v) => !v)}
          />
          {showList ? null : (
            <RoundButton
              label="◎"
              accessibilityLabel="Go to my location"
              onPress={() => void locateMe()}
            />
          )}
        </View>
        {!showList && selected ? (
          <SpotCard
            spot={selected}
            distanceM={distanceTo(selected)}
            onPress={() => openSpot(selected)}
          />
        ) : null}
        {!showList && !selected && data && spots.length === 0 ? (
          <View
            style={[styles.notice, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={{ color: colors.text }}>
              No spots here yet{hasActiveFilters(filters) ? ' with these filters' : ''}. Try moving
              the map or zooming out.
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function RoundButton({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
}) {
  const colors = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.roundButton,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.roundLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    elevation: 3,
  },
  searchInput: { flex: 1, fontSize: fontSize.md },
  spinner: { marginLeft: spacing.sm },
  chips: { gap: spacing.sm, paddingRight: spacing.md },
  notice: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    elevation: 2,
  },
  listOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  list: { gap: spacing.sm, padding: spacing.md, paddingBottom: 96 },
  bottom: { position: 'absolute', left: spacing.md, right: spacing.md, bottom: 0, gap: spacing.sm },
  bottomButtons: { flexDirection: 'row', justifyContent: 'space-between' },
  roundButton: {
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  roundLabel: { fontSize: fontSize.md, fontWeight: '600' },
});
