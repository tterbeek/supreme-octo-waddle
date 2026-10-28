import { useEffect, useRef, useState } from 'react';
import { IconLoader2 } from '@tabler/icons-react';
import ActivitySourceMark from './ActivitySourceMark';
import { routeMapUrl } from '../lib/mapbox';
import { retryActivityImport, type ImportingActivity } from '../services/activityImport.service';

export default function ImportingActivityCard({ activity, onMapLoaded }: {
  activity: ImportingActivity; onMapLoaded?: (url: string) => void;
}) {
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [near, setNear] = useState(false);
  const [now, setNow] = useState(Date.now);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (activity.import_status !== 'processing') return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [activity.import_status]);
  const stale = activity.import_status === 'processing' && (!activity.import_updated_at || now - Date.parse(activity.import_updated_at) > 120_000);
  const failed = activity.import_status === 'failed' || stale;
  const map = activity.import_status === 'ready' ? routeMapUrl(activity.route_polyline) : null;
  useEffect(() => {
    if (!map || !ref.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setNear(true); observer.disconnect(); }
    }, { rootMargin: '150px' });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [map]);
  async function retry() {
    setError('');
    if (map) { setImageFailed(false); setAttempt(value => value + 1); return; }
    setRetrying(true);
    try { await retryActivityImport(activity); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not retry.'); }
    finally { setRetrying(false); }
  }
  return <article ref={ref} className="rounded-2xl border border-movenotes-primary/15 bg-movenotes-surface p-5 sm:p-6" aria-label="Activity being imported" aria-busy={!failed && !imageFailed}>
    <div className="flex items-center gap-3">
      {!failed && !imageFailed && <IconLoader2 size={22} className="shrink-0 animate-spin motion-reduce:animate-none text-movenotes-primary" aria-hidden="true" />}
      <div className="min-w-0">
        <p className="font-medium">{failed || imageFailed ? 'Import waiting to finish' : 'New activity being imported'}</p>
        <div className="mt-1 text-sm text-movenotes-muted"><ActivitySourceMark source={activity.external_source || 'import'} /></div>
      </div>
    </div>
    <p className="mt-3 text-sm text-movenotes-muted" role="status">{imageFailed ? 'The map could not load. Retry to finish preparing this activity.' : failed ? 'Preparation was interrupted. Retry to finish importing this activity.' : map ? 'Loading your map…' : 'Preparing the activity name and route. You can keep using MoveNotes.'}</p>
    <div className="mt-4 space-y-2 opacity-40" aria-hidden="true">
      <div className="h-3 w-2/3 rounded bg-movenotes-primary/15" />
      <div className="h-3 w-1/3 rounded bg-movenotes-primary/10" />
    </div>
    {(failed || imageFailed) && <button type="button" onClick={() => void retry()} disabled={retrying} className="mt-2 inline-flex min-h-11 items-center text-sm text-movenotes-primary underline disabled:opacity-50">{retrying ? 'Retrying…' : 'Retry import'}</button>}
    {error && <p className="mt-2 text-sm" role="alert">{error}</p>}
    {map && near && !imageFailed && <img key={attempt} src={map} alt="" referrerPolicy="strict-origin-when-cross-origin" className="hidden" onLoad={() => onMapLoaded?.(map)} onError={() => setImageFailed(true)} />}
  </article>;
}
