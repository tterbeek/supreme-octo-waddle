import { useEffect, useRef, useState } from 'react';
import { IconMap2 } from '@tabler/icons-react';
import { mapboxToken, routeMapUrl } from '../lib/mapbox';
import { loadPolarRoute } from '../services/activityRoute.service';
import ModalSheet from './ModalSheet';

export default function ActivityRouteMap({ activityId, source, polyline, checkedAt, preview = true }: {
  activityId: string; source: string; polyline?: string | null; checkedAt?: string | null; preview?: boolean;
}) {
  const target = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [route, setRoute] = useState(polyline || null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [checked, setChecked] = useState(!!checkedAt && Date.now() - Date.parse(checkedAt) < 86400_000);
  const [failedPreview, setFailedPreview] = useState('');
  const [failedLarge, setFailedLarge] = useState('');
  const configured = mapboxToken.startsWith('pk.');

  useEffect(() => {
    setRoute(polyline || null);
    setChecked(!!checkedAt && Date.now() - Date.parse(checkedAt) < 86400_000);
    setBusy(false);
    setError('');
  }, [activityId, polyline, checkedAt]);

  useEffect(() => {
    if (!configured || !target.current || visible) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } }, { rootMargin: '150px' });
    observer.observe(target.current);
    return () => observer.disconnect();
  }, [configured, route, source, visible]);

  useEffect(() => {
    let cancelled = false;
    if (!configured || source !== 'polar' || route || checked || !(open || (preview && visible))) return;
    setBusy(true); setError('');
    void loadPolarRoute(activityId).then(value => {
      if (!cancelled) { setRoute(value); setChecked(true); }
    }).catch(() => { if (!cancelled) setError('Could not load the route. Please try again.'); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [activityId, source, configured, route, checked, open, preview, visible, retry]);

  if (!configured || (!route && source !== 'polar')) return null;
  const image = routeMapUrl(route);
  const largeImage = routeMapUrl(route, undefined, undefined, true);
  const mapFrameClass = 'rounded-xl border border-movenotes-primary/15 bg-movenotes-map shadow-[0_1px_5px_rgba(28,30,33,0.065)]';
  const retryButton = <button type="button" className="min-h-11 underline text-sm" onClick={event => { event.stopPropagation(); setFailedPreview(''); setFailedLarge(''); setRetry(value => value + 1); }}>Retry map</button>;
  return <div ref={target} className="mt-3" data-swipe-ignore="true" onClick={event => event.stopPropagation()}>
    {preview ? image && visible ? <button type="button" aria-label="Open activity route map" onClick={() => setOpen(true)} className={`block w-full overflow-hidden ${mapFrameClass}`}>
      {failedPreview !== image ? <img src={image} alt="Map of your activity route" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" className="aspect-video w-full object-contain" onError={() => setFailedPreview(image)} /> : <span className="block p-4 text-sm text-movenotes-muted">Map unavailable. Tap to try the larger view.</span>}
    </button> : busy ? <p role="status" className="text-xs text-movenotes-muted">Loading route…</p> : null
      : (!checked || !!route) && <button type="button" aria-label="Open activity route map" className="inline-flex min-h-11 items-center gap-2 text-sm text-movenotes-primary" onClick={() => setOpen(true)}><IconMap2 size={18}/>View route</button>}
    {preview && error && <div role="alert" className="text-sm text-movenotes-muted">{error} {retryButton}</div>}
    {open && <ModalSheet title="Activity route" onClose={() => setOpen(false)} presentation="dialog" sheetClassName="max-w-4xl">
      {busy ? <p role="status">Loading route…</p> : largeImage && failedLarge !== largeImage ? <img src={largeImage} alt="Map of your activity route" referrerPolicy="strict-origin-when-cross-origin" className={`h-auto w-full ${mapFrameClass}`} onError={() => setFailedLarge(largeImage)} />
        : error || (largeImage && failedLarge) ? <div role="alert"><p>{error || 'The map could not load. Please try again.'}</p>{retryButton}</div> : <p>No GPS route is available for this activity.</p>}
    </ModalSheet>}
  </div>;
}
