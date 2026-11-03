import type { Coordinates } from '@parkhere/shared';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';

import { Body, Button } from '@/components/ui';
import { fontSize, radius, spacing, useTheme } from '@/theme';

// MG Road, Bengaluru: used until the device location is known.
const FALLBACK: Coordinates = { lat: 12.9716, lng: 77.5946 };
const ZOOMED_IN = { latitudeDelta: 0.004, longitudeDelta: 0.004 };

export type AddressSuggestion = { address: string; areaLabel: string };

type Props = {
  value: Coordinates | null;
  onChange: (value: Coordinates) => void;
  onAddressSuggestion: (suggestion: AddressSuggestion) => void;
};

/** Move the map under a fixed centre pin to choose the exact spot location. */
export function LocationPicker({ value, onChange, onAddressSuggestion }: Props) {
  const colors = useTheme();
  const mapRef = useRef<MapView>(null);
  const [status, setStatus] = useState<string | null>(null);
  const start = value ?? FALLBACK;

  async function ensurePermission(): Promise<boolean> {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) setStatus('Location permission is off. Move the map to your spot instead.');
    return granted;
  }

  async function goToCurrentLocation() {
    if (!(await ensurePermission())) return;
    setStatus('Finding your location…');
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const here = { lat: position.coords.latitude, lng: position.coords.longitude };
      mapRef.current?.animateToRegion(
        { latitude: here.lat, longitude: here.lng, ...ZOOMED_IN },
        500,
      );
      onChange(here);
      setStatus(null);
    } catch {
      setStatus("Couldn't get your location. Move the map to your spot instead.");
    }
  }

  async function fillAddress() {
    if (!value || !(await ensurePermission())) return;
    try {
      const [place] = await Location.reverseGeocodeAsync({
        latitude: value.lat,
        longitude: value.lng,
      });
      if (!place) return;
      const street = [place.streetNumber, place.street].filter(Boolean).join(' ');
      const address =
        place.formattedAddress ??
        [place.name, street, place.district, place.city, place.postalCode]
          .filter(Boolean)
          .join(', ');
      const areaLabel = [place.district ?? place.subregion, place.city].filter(Boolean).join(', ');
      onAddressSuggestion({ address, areaLabel });
    } catch {
      setStatus("Couldn't look up the address. Type it in below.");
    }
  }

  // New spot: centre on the device if location access was already granted earlier.
  const isNew = useRef(value === null).current;
  useEffect(() => {
    if (!isNew) return;
    void Location.getForegroundPermissionsAsync().then(({ granted }) => {
      if (granted) void goToCurrentLocation();
    });
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRegionChange(region: Region) {
    onChange({ lat: region.latitude, lng: region.longitude });
  }

  return (
    <View style={styles.container}>
      <View style={[styles.mapFrame, { borderColor: colors.border }]}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={{ latitude: start.lat, longitude: start.lng, ...ZOOMED_IN }}
          onRegionChangeComplete={handleRegionChange}
          showsUserLocation
          toolbarEnabled={false}
        />
        {/* The pin is drawn over the map; its tip marks the map centre. */}
        <View pointerEvents="none" style={styles.pinWrapper}>
          <Text style={styles.pin}>📍</Text>
        </View>
      </View>
      <Body muted>
        {value
          ? `Pin at ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}. Drivers only see the exact pin after booking.`
          : 'Move the map so the pin sits on your parking spot.'}
      </Body>
      {status ? <Text style={[styles.status, { color: colors.textMuted }]}>{status}</Text> : null}
      <View style={styles.buttons}>
        <Button label="Use my location" variant="secondary" onPress={goToCurrentLocation} />
        <Button
          label="Fill address from pin"
          variant="secondary"
          onPress={fillAddress}
          disabled={!value}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  mapFrame: {
    height: 260,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pinWrapper: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Lift the emoji so its tip, not its centre, sits on the map centre.
  pin: { fontSize: 36, marginBottom: 36 },
  status: { fontSize: fontSize.sm },
  buttons: { gap: spacing.sm },
});
