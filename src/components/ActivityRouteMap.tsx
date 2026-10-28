import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { IconMap2, IconMaximize } from '@tabler/icons-react';
import { mapboxToken, routeMapUrl } from '../lib/mapbox';
import { loadPolarRoute } from '../services/activityRoute.service';
import ModalSheet from './ModalSheet';

const InteractiveRouteMap = lazy(() => import('./InteractiveRouteMap'));

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
  const mapFrameClass = 'rounded-xl border border-movenotes-primary/15 bg-movenotes-map shadow-[0_1px_5px_rgba(28,30,33,0.065)]';
  const retryButton = <button type="button" className="min-h-11 underline text-sm" onClick={event => { event.stopPropagation(); setFailedPreview(''); setRetry(value => value + 1); }}>Retry map</button>;
  return <div ref={target} className="mt-3" data-swipe-ignore="true" onClick={event => event.stopPropagation()}>
    {preview ? image && visible ? <div data-route-preview className={`relative w-full overflow-hidden ${mapFrameClass}`}>
      {failedPreview !== image ? <img src={image} alt="Map of your activity route" draggable={false} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" className="aspect-video w-full object-contain" onError={() => setFailedPreview(image)} /> : <span className="block min-h-28 p-4 pr-16 text-sm text-movenotes-muted">Map preview unavailable. Use the maximize button to open the interactive map.</span>}
      <button type="button" aria-label="Open fullscreen activity route map" title="Open fullscreen map" onClick={() => setOpen(true)} className="absolute bottom-6 right-2 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/85 text-movenotes-primary shadow-sm hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-movenotes-primary"><IconMaximize size={22} strokeWidth={1.6} aria-hidden="true" /></button>
    </div> : busy ? <p role="status" className="text-xs text-movenotes-muted">Loading route…</p> : null
      : (!checked || !!route) && <button type="button" aria-label="Open fullscreen activity route map" className="inline-flex min-h-11 items-center gap-2 text-sm text-movenotes-primary" onClick={() => setOpen(true)}><IconMap2 size={18}/>View route</button>}
    {preview && error && <div role="alert" className="text-sm text-movenotes-muted">{error} {retryButton}</div>}
    {open && <ModalSheet title="Activity route" onClose={() => setOpen(false)} presentation="fullscreen" sheetClassName="mn-route-map-panel">
      {busy ? <p role="status" className="p-4">Loading route…</p> : route ? <Suspense fallback={<p role="status" className="p-4">Loading interactive map…</p>}><InteractiveRouteMap polyline={route} /></Suspense>
        : error ? <div role="alert" className="p-4"><p>{error}</p>{retryButton}</div> : <p className="p-4">No GPS route is available for this activity.</p>}
    </ModalSheet>}
  </div>;
}
