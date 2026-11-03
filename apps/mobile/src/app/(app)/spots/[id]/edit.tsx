import { toUserMessage } from '@parkhere/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { useMySpot, useUpdateSpot, type MySpot } from '@/api/spots';
import { ErrorText } from '@/components/ui';
import { SpotForm } from '@/features/spots/spot-form';
import { spotToFormValues } from '@/features/spots/spot-format';
import { spacing } from '@/theme';

export default function EditSpotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: spot, error, isPending } = useMySpot(id);

  if (isPending) return <ActivityIndicator style={styles.loading} />;
  if (error || !spot) {
    return (
      <View style={styles.message}>
        <ErrorText>{toUserMessage(error)}</ErrorText>
      </View>
    );
  }
  return <EditSpotForm spot={spot} />;
}

function EditSpotForm({ spot }: { spot: MySpot }) {
  const router = useRouter();
  const updateSpot = useUpdateSpot(spot);

  return (
    <SpotForm
      initialValues={spotToFormValues(spot)}
      initialPhotos={spot.photos}
      submitLabel="Save changes"
      submitting={updateSpot.isPending}
      error={updateSpot.error ? toUserMessage(updateSpot.error) : null}
      onSubmit={(input, photos) =>
        updateSpot.mutate(
          { input, photos },
          {
            onSuccess: ({ photosFailed }) => {
              if (photosFailed) {
                Alert.alert('Saved, but some photos failed', 'Open Edit to try adding them again.');
              }
              router.back();
            },
          },
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  loading: { marginTop: spacing.xxl },
  message: { padding: spacing.lg },
});
