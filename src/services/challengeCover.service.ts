import { supabase } from '../supabaseClient';
import { compressImage, uploadActivityImage, deleteActivityImages } from './activityMedia.service';
import { socialChallenges, type Challenge } from './social.service';
import type { Json } from '../database.types';

export async function saveChallengeWithCover(community: string, action: string, values: Record<string, Json>, file?: File | null, removeCover = false): Promise<Challenge[]> {
  let uploaded: string | null = null;
  try {
    if (file) {
      if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw new Error('Sign in required');
      const image = await compressImage(file);
      uploaded = (await uploadActivityImage(data.user.id, 'challenge-cover', image)).imagePath;
    }
    return await socialChallenges(community, action, { ...values, ...(uploaded ? { cover_path: uploaded } : removeCover ? { cover_path: null } : {}) });
  } catch (error) {
    if (uploaded) await deleteActivityImages([uploaded]).catch(() => {});
    throw error;
  }
}
