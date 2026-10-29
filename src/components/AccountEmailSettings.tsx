import { useCallback, useEffect, useRef, useState } from 'react';
import ModalSheet from './ModalSheet';
import { FormActions, FormError } from './forms/FormLayout';
import { supabase } from '../supabaseClient';
import { accountEmail, readAccountEmail, requestEmailChange, resendEmailChange, type AccountEmail } from '../services/accountEmail.service';

function ChangeEmailSheet({ status, onClose, onRequested }: { status: AccountEmail; onClose: () => void; onRequested: (value: AccountEmail) => void }) {
  const initial = status.pending || '';
  const [email, setEmail] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sending = useRef(false);
  async function send() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true); setError('');
    try { onRequested(await requestEmailChange(email)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not request the change. Please try again.'); }
    finally { sending.current = false; setBusy(false); }
  }
  return <ModalSheet title="Change login email" onClose={onClose} dirty={email !== initial} busy={busy}>
    <p className="text-sm text-movenotes-muted">Current email: <span className="break-all">{status.current}</span></p>
    <div className="mn-field"><label htmlFor="new-account-email">New email address</label><input id="new-account-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={event => setEmail(event.target.value)} className="w-full" /></div>
    <p className="mn-help">Confirm your new address using the email we send. Your current inbox may also need confirmation. Keep using your current login email until the change is complete.</p>
    <FormError>{error}</FormError>
    <FormActions><button type="button" onClick={() => void send()} disabled={busy || !email.trim()}>{busy ? 'Requesting change…' : 'Send confirmation'}</button></FormActions>
  </ModalSheet>;
}

export default function AccountEmailSettings({ userId }: { userId: string }) {
  const [status, setStatus] = useState<AccountEmail | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendAfter, setResendAfter] = useState(0);
  const [now, setNow] = useState(Date.now);
  const previous = useRef<AccountEmail | null>(null);
  const accept = useCallback((next: AccountEmail) => {
    if (next.userId !== userId) return;
    const last = previous.current;
    if (last?.userId === userId && last.pending && !next.pending && last.current !== next.current) setNotice('Login email updated.');
    previous.current = next;
    setStatus(next);
  }, [userId]);
  const refresh = useCallback(async () => {
    const next = await readAccountEmail();
    accept(next);
    return next;
  }, [accept]);
  useEffect(() => {
    let active = true;
    const load = () => void readAccountEmail().then(next => {
      if (active) accept(next);
    }).catch(cause => { if (active) setError(cause.message); });
    load();
    const focus = () => { if (document.visibilityState === 'visible') load(); };
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus);
    // No async Auth call inside this callback: the SDK may still hold its lock.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user.id === userId) accept(accountEmail(session.user));
      else if (!session) setStatus(null);
    });
    return () => { active = false; data.subscription.unsubscribe(); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
  }, [userId, accept]);
  useEffect(() => {
    if (!resendAfter) return;
    const timer = setInterval(() => { const time = Date.now(); setNow(time); if (time >= resendAfter) setResendAfter(0); }, 1000);
    return () => clearInterval(timer);
  }, [resendAfter]);
  async function check(resend = false) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const next = resend ? await resendEmailChange() : await refresh();
      if (next.userId !== userId) return;
      accept(next);
      if (resend && next.pending) { setResendAfter(Date.now() + 60_000); setNow(Date.now()); }
      setNotice(next.pending ? resend ? 'Confirmation requested again. Please check your inboxes.' : 'Still awaiting email confirmation.' : 'Your account email is up to date.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not check your email change.'); }
    finally { setBusy(false); }
  }
  const current = status?.userId === userId ? status : null;
  return <section aria-label="Login email" className="space-y-3 rounded-xl border border-warm-200 p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="text-sm font-semibold">Login email</h2><p className="break-all text-sm text-movenotes-muted">{current?.current || 'Loading account email…'}</p></div>
      <button type="button" className="min-h-11 text-sm text-movenotes-primary underline" disabled={!current || busy} onClick={() => { setError(''); setNotice(''); setOpen(true); }}>Change email</button>
    </div>
    {current?.pending && <div className="space-y-2 text-sm">
      <p>Awaiting confirmation: <span className="break-all font-medium">{current.pending}</span></p>
      <p className="mn-help">Check your new inbox and, if required, your current inbox. Your login email changes only after confirmation.</p>
      <div className="flex flex-wrap gap-x-4"><button type="button" className="min-h-11 text-movenotes-primary underline" disabled={busy} onClick={() => void check()}>Check confirmation</button><button type="button" className="min-h-11 text-movenotes-primary underline disabled:opacity-50" disabled={busy || now < resendAfter} onClick={() => void check(true)}>Resend confirmation</button></div>
    </div>}
    {notice && <p role="status" className="text-sm text-movenotes-primary">{notice}</p>}
    <FormError>{error}</FormError>
    {!current && error && <button type="button" className="min-h-11 underline" disabled={busy} onClick={() => void check()}>Retry</button>}
    {open && current && <ChangeEmailSheet status={current} onClose={() => setOpen(false)} onRequested={next => {
      accept(next); setOpen(false); setError(''); setResendAfter(Date.now() + 60_000); setNow(Date.now());
      setNotice(next.pending ? 'Email change requested. Please follow the confirmation instructions in your inboxes.' : 'Login email updated.');
    }} />}
  </section>;
}
