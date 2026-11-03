import { zodResolver } from '@hookform/resolvers/zod';
import {
  MAX_SPOT_PHOTOS,
  VEHICLE_TYPE_LABELS,
  type SpotInput,
  type VehicleType,
} from '@parkhere/shared';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Chip, ChipRow, FieldError, SectionTitle, SwitchRow } from '@/components/form';
import { Body, Button, ErrorText, TextField } from '@/components/ui';
import { LocationPicker } from '@/features/spots/location-picker';
import { pickPhotos, type SpotPhoto } from '@/features/spots/photos';
import {
  ALL_WEEKDAYS,
  spotFormSchema,
  type SpotFormValues,
} from '@/features/spots/spot-form-schema';
import { radius, spacing, useTheme } from '@/theme';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const VEHICLE_TYPES = Object.keys(VEHICLE_TYPE_LABELS) as VehicleType[];

type Props = {
  initialValues: SpotFormValues;
  initialPhotos?: SpotPhoto[];
  submitLabel: string;
  submitting: boolean;
  error: string | null;
  onSubmit: (input: SpotInput, photos: SpotPhoto[]) => void;
};

export function SpotForm({
  initialValues,
  initialPhotos = [],
  submitLabel,
  submitting,
  error,
  onSubmit,
}: Props) {
  const colors = useTheme();
  const [photos, setPhotos] = useState<SpotPhoto[]>(initialPhotos);
  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitted },
  } = useForm<SpotFormValues, unknown, SpotInput>({
    resolver: zodResolver(spotFormSchema),
    defaultValues: initialValues,
  });
  // useWatch (unlike watch()) is compatible with React Compiler memoization.
  const open24h = useWatch({ control, name: 'open24h' });

  async function addPhotos() {
    const picked = await pickPhotos(MAX_SPOT_PHOTOS - photos.length);
    setPhotos((current) => [...current, ...picked].slice(0, MAX_SPOT_PHOTOS));
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <SectionTitle>Basics</SectionTitle>
        <Controller
          control={control}
          name="title"
          render={({ field }) => (
            <TextField
              label="Title"
              placeholder="e.g. Covered driveway near metro"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />
        <FieldError message={errors.title?.message} />
        <Controller
          control={control}
          name="description"
          render={({ field }) => (
            <TextField
              label="Description (optional)"
              placeholder="Anything drivers should know"
              multiline
              value={field.value}
              onChangeText={field.onChange}
            />
          )}
        />
        <FieldError message={errors.description?.message} />

        <SectionTitle>Location</SectionTitle>
        <Controller
          control={control}
          name="location"
          render={({ field }) => (
            <LocationPicker
              value={field.value}
              onChange={field.onChange}
              onAddressSuggestion={({ address, areaLabel }) => {
                setValue('address', address, { shouldValidate: isSubmitted });
                if (!getValues('areaLabel')) setValue('areaLabel', areaLabel);
              }}
            />
          )}
        />
        <FieldError message={errors.location?.message} />
        <Controller
          control={control}
          name="address"
          render={({ field }) => (
            <TextField
              label="Full address (private until booked)"
              placeholder="House number, street, area"
              value={field.value}
              onChangeText={field.onChange}
            />
          )}
        />
        <FieldError message={errors.address?.message} />
        <Controller
          control={control}
          name="areaLabel"
          render={({ field }) => (
            <TextField
              label="Area shown in search (optional)"
              placeholder="e.g. Indiranagar, Bengaluru"
              value={field.value}
              onChangeText={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="accessInstructions"
          render={({ field }) => (
            <TextField
              label="How to get in (optional, private until booked)"
              placeholder="e.g. Blue gate, ring the bell"
              multiline
              value={field.value}
              onChangeText={field.onChange}
            />
          )}
        />

        <SectionTitle>Vehicles and features</SectionTitle>
        <Controller
          control={control}
          name="vehicleTypes"
          render={({ field }) => (
            <ChipRow>
              {VEHICLE_TYPES.map((type) => {
                const selected = field.value.includes(type);
                return (
                  <Chip
                    key={type}
                    label={VEHICLE_TYPE_LABELS[type]}
                    selected={selected}
                    onPress={() =>
                      field.onChange(
                        selected
                          ? field.value.filter((value) => value !== type)
                          : [...field.value, type],
                      )
                    }
                  />
                );
              })}
            </ChipRow>
          )}
        />
        <FieldError message={errors.vehicleTypes?.message} />
        {(
          [
            ['isCovered', 'Covered'],
            ['hasCctv', 'CCTV'],
            ['hasSecurityGuard', 'Security guard'],
            ['hasEvCharging', 'EV charging'],
          ] as const
        ).map(([name, label]) => (
          <Controller
            key={name}
            control={control}
            name={name}
            render={({ field }) => (
              <SwitchRow label={label} value={field.value} onValueChange={field.onChange} />
            )}
          />
        ))}
        <Controller
          control={control}
          name="maxHeightCm"
          render={({ field }) => (
            <TextField
              label="Height limit in cm (optional)"
              placeholder="e.g. 210"
              keyboardType="number-pad"
              maxLength={3}
              value={field.value}
              onChangeText={field.onChange}
            />
          )}
        />
        <FieldError message={errors.maxHeightCm?.message} />

        <SectionTitle>Price</SectionTitle>
        <Controller
          control={control}
          name="hourlyRate"
          render={({ field }) => (
            <TextField
              label="Price per hour (₹)"
              placeholder="e.g. 40"
              keyboardType="decimal-pad"
              value={field.value}
              onChangeText={field.onChange}
            />
          )}
        />
        <FieldError message={errors.hourlyRate?.message} />
        <Controller
          control={control}
          name="instantBook"
          render={({ field }) => (
            <SwitchRow
              label="Instant book"
              description={
                field.value
                  ? 'Drivers paying your price are confirmed straight away. Lower offers still need your OK.'
                  : 'You approve every booking.'
              }
              value={field.value}
              onValueChange={field.onChange}
            />
          )}
        />

        <SectionTitle>Opening hours</SectionTitle>
        <Controller
          control={control}
          name="open24h"
          render={({ field }) => (
            <SwitchRow label="Open 24/7" value={field.value} onValueChange={field.onChange} />
          )}
        />
        {open24h ? null : (
          <View style={styles.hours}>
            <Controller
              control={control}
              name="openDays"
              render={({ field }) => (
                <ChipRow>
                  {ALL_WEEKDAYS.map((day) => {
                    const selected = field.value.includes(day);
                    return (
                      <Chip
                        key={day}
                        label={WEEKDAY_LABELS[day] ?? ''}
                        selected={selected}
                        onPress={() =>
                          field.onChange(
                            selected
                              ? field.value.filter((value) => value !== day)
                              : [...field.value, day].sort(),
                          )
                        }
                      />
                    );
                  })}
                </ChipRow>
              )}
            />
            <FieldError message={errors.openDays?.message} />
            <View style={styles.timeRow}>
              <View style={styles.flex}>
                <Controller
                  control={control}
                  name="opensAt"
                  render={({ field }) => (
                    <TextField
                      label="Opens"
                      placeholder="08:00"
                      maxLength={5}
                      keyboardType="numbers-and-punctuation"
                      value={field.value}
                      onChangeText={field.onChange}
                    />
                  )}
                />
                <FieldError message={errors.opensAt?.message} />
              </View>
              <View style={styles.flex}>
                <Controller
                  control={control}
                  name="closesAt"
                  render={({ field }) => (
                    <TextField
                      label="Closes"
                      placeholder="20:00"
                      maxLength={5}
                      keyboardType="numbers-and-punctuation"
                      value={field.value}
                      onChangeText={field.onChange}
                    />
                  )}
                />
                <FieldError message={errors.closesAt?.message} />
              </View>
            </View>
            <Body muted>Use 24-hour time. Enter 24:00 to stay open until midnight.</Body>
          </View>
        )}

        <SectionTitle>Photos</SectionTitle>
        <Body muted>
          Up to {MAX_SPOT_PHOTOS} photos. Show the entrance and the parking space itself.
        </Body>
        <View style={styles.photoGrid}>
          {photos.map((photo, index) => (
            <View key={photo.kind === 'remote' ? photo.id : photo.uri} style={styles.photoCell}>
              <Image
                source={{ uri: photo.kind === 'remote' ? photo.url : photo.uri }}
                style={[styles.photo, { backgroundColor: colors.border }]}
                contentFit="cover"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${index + 1}`}
                onPress={() => setPhotos((current) => current.filter((item) => item !== photo))}
                style={[styles.removePhoto, { backgroundColor: colors.surface }]}
              >
                <Text style={{ color: colors.text }}>✕</Text>
              </Pressable>
            </View>
          ))}
        </View>
        {photos.length < MAX_SPOT_PHOTOS ? (
          <Button label="Add photos" variant="secondary" onPress={addPhotos} />
        ) : null}

        <View style={styles.submit}>
          {isSubmitted && Object.keys(errors).length > 0 ? (
            <ErrorText>Some details need fixing. Check the highlighted fields above.</ErrorText>
          ) : null}
          <ErrorText>{error}</ErrorText>
          <Button
            label={submitLabel}
            loading={submitting}
            onPress={handleSubmit((input) => onSubmit(input, photos))}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xxl * 2 },
  hours: { gap: spacing.sm },
  timeRow: { flexDirection: 'row', gap: spacing.md },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoCell: { width: 100, height: 100 },
  photo: { width: 100, height: 100, borderRadius: radius.md },
  removePhoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submit: { marginTop: spacing.xl, gap: spacing.sm },
});
