import { expect, it } from 'vitest';
import { socialMediaUrl } from './socialMedia';

it('uses the browser gateway for local Edge-signed media, preserving its signed path and query', () => {
  expect(socialMediaUrl('http://kong:8000/storage/v1/object/sign/actvity-notes/owner/photo.jpg?token=fictional', 'http://127.0.0.1:54321'))
    .toBe('http://127.0.0.1:54321/storage/v1/object/sign/actvity-notes/owner/photo.jpg?token=fictional');
});
it('supports the configured LAN address and named local Kong containers', () => {
  expect(socialMediaUrl('http://supabase_kong_local:8000/storage/v1/object/sign/activity-notes/avatar.jpg?token=fictional', 'http://192.168.1.5:54321'))
    .toBe('http://192.168.1.5:54321/storage/v1/object/sign/activity-notes/avatar.jpg?token=fictional');
});
it('leaves hosted signed URLs and non-storage URLs unchanged', () => {
  for (const value of ['https://project.supabase.co/storage/v1/object/sign/actvity-notes/avatar.jpg?token=fictional', 'http://kong:8000/auth/v1/user', 'data:image/png;base64,fictional']) {
    expect(socialMediaUrl(value, 'http://127.0.0.1:54321')).toBe(value);
  }
});
