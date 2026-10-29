import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import HeaderLogo from '../components/HeaderLogo';
import { readAccountEmail, type AccountEmail } from '../services/accountEmail.service';

/** Public landing page: the first of two confirmations may not create a session. */
export default function EmailChangePage() {
  const [status, setStatus] = useState<AccountEmail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failedLink] = useState(() => {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.slice(1));
    return Boolean(url.searchParams.get('error') || url.searchParams.get('error_code') || hash.get('error') || hash.get('error_code'));
  });
  useEffect(() => {
    let active = true;
    // getUser waits for the SDK's automatic session processing of confirmation links.
    void readAccountEmail().then(value => { if (active) setStatus(value); }).catch(() => {
      // A partial confirmation or a different browser may have no signed-in session.
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-movenotes-bg px-5 py-10">
    <HeaderLogo withTagline />
    <section className="w-full max-w-md space-y-4 rounded-2xl border border-warm-200 bg-warm-100 p-6">
      <h1 className="text-xl font-semibold">Email confirmation</h1>
      {loading ? <p role="status">Checking your account…</p> : failedLink ? <p role="alert">This confirmation link has expired or could not be verified. Sign in and request another confirmation from Profile.</p>
        : status?.pending ? <><p>Your email change is still awaiting confirmation for <span className="break-all font-medium">{status.pending}</span>.</p><p className="text-sm text-movenotes-muted">Check the confirmation instructions in both inboxes. Keep using <span className="break-all">{status.current}</span> until the change is complete.</p></>
          : status ? <p>Your current login email is <span className="break-all font-medium">{status.current}</span>.</p>
            : <p>Follow the confirmation instructions in your new inbox and, if required, your current inbox. Then sign in to check your updated email in Profile.</p>}
      {!loading && <Link className="mn-primary inline-flex min-h-11 items-center justify-center" to={status ? '/settings/profile' : '/login?next=%2Fsettings%2Fprofile'}>{status ? 'Continue to Profile' : 'Sign in'}</Link>}
    </section>
  </main>;
}
