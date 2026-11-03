import { MAX_SPOT_PHOTOS, SPOT_PHOTOS_BUCKET } from '@parkhere/shared';
import { decode } from 'base64-arraybuffer';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

/** A photo in the spot form: already uploaded, or picked on this device and not yet saved. */
export type SpotPhoto =
  { kind: 'remote'; id: string; path: string; url: string } | { kind: 'local'; uri: string };

export function photoUrl(path: string): string {
  return supabase.storage.from(SPOT_PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function pickPhotos(remaining: number): Promise<SpotPhoto[]> {
  if (remaining <= 0) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: Math.min(remaining, MAX_SPOT_PHOTOS),
    quality: 1,
  });
  if (result.canceled) return [];
  return result.assets.slice(0, remaining).map((asset) => ({ kind: 'local', uri: asset.uri }));
}

function randomName(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Resizes to 1280 px wide and JPEG-compresses (~150-300 KB) before uploading. */
async function uploadOne(userId: string, spotId: string, uri: string, sortOrder: number) {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: 1280 });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!saved.base64) throw new Error('Could not process the photo');

  // Storage policy: users may only write inside a folder named after their user id.
  const path = `${userId}/${spotId}/${randomName()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(SPOT_PHOTOS_BUCKET)
    .upload(path, decode(saved.base64), { contentType: 'image/jpeg' });
  if (uploadError) throw uploadError;

  const { error: rowError } = await supabase
    .from('spot_photos')
    .insert({ spot_id: spotId, storage_path: path, sort_order: sortOrder });
  if (rowError) {
    await supabase.storage.from(SPOT_PHOTOS_BUCKET).remove([path]);
    throw rowError;
  }
}

/** Applies the form's photo list to the database: uploads new ones, removes deleted ones. */
export async function syncSpotPhotos(
  userId: string,
  spotId: string,
  photos: SpotPhoto[],
  original: SpotPhoto[],
) {
  const keptIds = new Set(photos.flatMap((photo) => (photo.kind === 'remote' ? [photo.id] : [])));
  const removed = original.filter(
    (photo): photo is Extract<SpotPhoto, { kind: 'remote' }> =>
      photo.kind === 'remote' && !keptIds.has(photo.id),
  );

  if (removed.length > 0) {
    const { error } = await supabase
      .from('spot_photos')
      .delete()
      .in(
        'id',
        removed.map((photo) => photo.id),
      );
    if (error) throw error;
    await supabase.storage.from(SPOT_PHOTOS_BUCKET).remove(removed.map((photo) => photo.path));
  }

  for (const [index, photo] of photos.entries()) {
    if (photo.kind === 'local') await uploadOne(userId, spotId, photo.uri, index);
  }
}
