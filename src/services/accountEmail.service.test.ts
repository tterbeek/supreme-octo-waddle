import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ getUser: vi.fn(), updateUser: vi.fn(), resend: vi.fn() }));
vi.mock('../supabaseClient', () => ({ supabase: { auth } }));
import { accountEmail, readAccountEmail, requestEmailChange, resendEmailChange } from './accountEmail.service';
const owner = { id: 'stable-user-id', email: 'old@example.test', new_email: '' };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal('window', { location: { origin: 'http://127.0.0.1:5173' } });
  auth.getUser.mockResolvedValue({ data: { user: owner }, error: null });
  auth.updateUser.mockResolvedValue({ data: { user: { ...owner, new_email: 'new@example.test' } }, error: null });
});
afterEach(() => vi.unstubAllGlobals());
describe('account email changes', () => {
  it('uses the existing account through Auth, without updating app profile data prematurely', async () => {
    expect(await requestEmailChange(' New@Example.test ')).toEqual({ userId: owner.id, current: owner.email, pending: 'new@example.test' });
    expect(auth.updateUser).toHaveBeenCalledExactlyOnceWith({ email: 'new@example.test' }, { emailRedirectTo: 'http://127.0.0.1:5173/auth/email-change' });
  });
  it('validates addresses and requires a fresh authenticated user', async () => {
    await expect(requestEmailChange('not-an-email')).rejects.toThrow('valid email');
    await expect(requestEmailChange('OLD@example.test')).rejects.toThrow('different email');
    expect(auth.updateUser).not.toHaveBeenCalled();
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(readAccountEmail()).rejects.toThrow('Sign in');
    await expect(requestEmailChange('new@example.test')).rejects.toThrow('Sign in');
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
  it('does not claim confirmation on errors and recognizes an already applied change', async () => {
    auth.updateUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Rate limit exceeded' } });
    await expect(requestEmailChange('new@example.test')).rejects.toThrow('Rate limit exceeded');
    auth.updateUser.mockResolvedValueOnce({ data: { user: { ...owner, email: 'new@example.test' } }, error: null });
    expect(await requestEmailChange('new@example.test')).toEqual({ userId: owner.id, current: 'new@example.test', pending: null });
  });
  it('resends only the server-reported pending change', async () => {
    auth.resend.mockResolvedValue({ error: null });
    await resendEmailChange(); expect(auth.resend).not.toHaveBeenCalled();
    auth.getUser.mockResolvedValue({ data: { user: { ...owner, new_email: 'pending@example.test' } }, error: null });
    await resendEmailChange();
    expect(auth.resend).toHaveBeenCalledExactlyOnceWith({ type: 'email_change', email: 'pending@example.test', options: { emailRedirectTo: 'http://127.0.0.1:5173/auth/email-change' } });
  });
  it('keeps the stable ID and ignores a cleared/matching pending address', () => {
    expect(accountEmail({ ...owner, new_email: 'OLD@example.test' })).toEqual({ userId: owner.id, current: owner.email, pending: null });
  });
  it('does not claim a change when the response still describes the old account state', async () => {
    auth.updateUser.mockResolvedValue({ data: { user: owner }, error: null });
    await expect(requestEmailChange('new@example.test')).rejects.toThrow('Could not verify');
  });
});
