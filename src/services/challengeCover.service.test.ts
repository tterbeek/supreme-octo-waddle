import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), compress: vi.fn(), upload: vi.fn(), remove: vi.fn(), save: vi.fn() }));
vi.mock('../supabaseClient', () => ({ supabase: { auth: { getUser: mocks.getUser } } }));
vi.mock('./activityMedia.service', () => ({ compressImage: mocks.compress, uploadActivityImage: mocks.upload, deleteActivityImages: mocks.remove }));
vi.mock('./social.service', () => ({ socialChallenges: mocks.save }));
import { saveChallengeWithCover } from './challengeCover.service';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'owner' } }, error: null });
  mocks.compress.mockResolvedValue(new Blob(['compressed'], { type: 'image/jpeg' }));
  mocks.upload.mockResolvedValue({ imagePath: 'owner/challenge-cover-new.jpg' });
  mocks.remove.mockResolvedValue(undefined); mocks.save.mockResolvedValue([]);
});
it('uploads a compressed cover in its own namespace and attaches it to the existing challenge', async () => {
  const file = new File(['fictional'], 'cover.png', { type: 'image/png' });
  await saveChallengeWithCover('community', 'cover', { id: 'challenge' }, file);
  expect(mocks.compress).toHaveBeenCalledWith(file);
  expect(mocks.upload).toHaveBeenCalledWith('owner', 'challenge-cover', expect.any(Blob));
  expect(mocks.save).toHaveBeenCalledWith('community', 'cover', { id: 'challenge', cover_path: 'owner/challenge-cover-new.jpg' });
  expect(mocks.remove).not.toHaveBeenCalled();
});
it('cleans up only the newly uploaded file if attaching it fails', async () => {
  mocks.save.mockRejectedValueOnce(new Error('Not authorized'));
  await expect(saveChallengeWithCover('community', 'cover', { id: 'challenge' }, new File(['test'], 'cover.jpg', { type: 'image/jpeg' }))).rejects.toThrow('Not authorized');
  expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(['owner/challenge-cover-new.jpg']);
});
it('preserves an existing cover during unrelated edits and supports explicit removal', async () => {
  await saveChallengeWithCover('community', 'update', { id: 'challenge', title: 'Renamed' });
  expect(mocks.upload).not.toHaveBeenCalled();
  expect(mocks.save).toHaveBeenLastCalledWith('community', 'update', { id: 'challenge', title: 'Renamed' });
  await saveChallengeWithCover('community', 'update', { id: 'challenge' }, null, true);
  expect(mocks.save).toHaveBeenLastCalledWith('community', 'update', { id: 'challenge', cover_path: null });
});
it('rejects non-image files without uploading or changing the challenge', async () => {
  await expect(saveChallengeWithCover('community', 'cover', { id: 'challenge' }, new File(['test'], 'notes.txt', { type: 'text/plain' }))).rejects.toThrow('Choose an image');
  expect(mocks.upload).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
});
