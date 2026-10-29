import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

export type AccountEmail = { userId: string; current: string; pending: string | null };
export const EMAIL_CHANGE_PATH = '/auth/email-change';
export function accountEmail(user: Pick<User, 'id' | 'email' | 'new_email'>): AccountEmail {
  const current = user.email || '';
  const pending = user.new_email && user.new_email.toLowerCase() !== current.toLowerCase() ? user.new_email : null;
  return { userId: user.id, current, pending };
}

export async function readAccountEmail(): Promise<AccountEmail> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Sign in to view your account email.');
  return accountEmail(data.user);
}

export async function requestEmailChange(value: string): Promise<AccountEmail> {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please enter a valid email address.');
  const current = await readAccountEmail();
  if (email === current.current.toLowerCase()) throw new Error('Enter a different email address.');
  const { data, error } = await supabase.auth.updateUser({ email }, {
    emailRedirectTo: `${window.location.origin}${EMAIL_CHANGE_PATH}`,
  });
  if (error) throw new Error(error.message);
  if (!data.user || data.user.id !== current.userId) throw new Error('Could not request the email change. Please try again.');
  const next = accountEmail(data.user);
  if ((next.pending || next.current).toLowerCase() !== email) throw new Error('Could not verify the email-change request. Check your inbox or try again.');
  return next;
}

export async function resendEmailChange(): Promise<AccountEmail> {
  const status = await readAccountEmail();
  if (!status.pending) return status;
  const { error } = await supabase.auth.resend({ type: 'email_change', email: status.pending,
    options: { emailRedirectTo: `${window.location.origin}${EMAIL_CHANGE_PATH}` },
  });
  if (error) throw new Error(error.message);
  return status;
}
