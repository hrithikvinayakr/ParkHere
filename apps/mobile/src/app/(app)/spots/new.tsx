import { toUserMessage } from '@parkhere/shared';
import { useRouter } from 'expo-router';

import { useCreateSpot } from '@/api/spots';
import { SpotForm } from '@/features/spots/spot-form';
import { emptySpotForm } from '@/features/spots/spot-form-schema';

export default function NewSpotScreen() {
  const router = useRouter();
  const createSpot = useCreateSpot();

  return (
    <SpotForm
      initialValues={emptySpotForm}
      submitLabel="Publish spot"
      submitting={createSpot.isPending}
      error={createSpot.error ? toUserMessage(createSpot.error) : null}
      onSubmit={(input, photos) =>
        createSpot.mutate(
          { input, photos },
          {
            onSuccess: ({ spotId, photosFailed }) =>
              router.replace({
                pathname: '/spots/[id]',
                params: { id: spotId, ...(photosFailed ? { photosFailed: '1' } : {}) },
              }),
          },
        )
      }
    />
  );
}
