import { useEffect, useRef, useState } from 'react';
import * as mapboxgl from 'mapbox-gl/esm';
import 'mapbox-gl/dist/mapbox-gl.css';
import { IconFocus2 } from '@tabler/icons-react';
import { decodeRoute } from '../../supabase/functions/_shared/activityRoute';
import { mapboxStyle, mapboxToken } from '../lib/mapbox';

export default function InteractiveRouteMap({ polyline }: { polyline: string }) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<mapboxgl.Map | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!container.current) return;
    let map: mapboxgl.Map | undefined;
    let stopped = false;
    setLoading(true); setError('');
    const points = decodeRoute(polyline);
    if (points.length < 2) { setError('No GPS route is available for this activity.'); setLoading(false); return; }
    const bounds = new mapboxgl.LngLatBounds();
    points.forEach(([lat, lng]) => bounds.extend([lng, lat]));
    try {
      map = new mapboxgl.Map({
        container: container.current,
        accessToken: mapboxToken,
        style: `mapbox://styles/${mapboxStyle}`,
        bounds, fitBoundsOptions: { padding: 48, maxZoom: 16, duration: 0 },
        maxPitch: 0, dragRotate: false, pitchWithRotate: false,
      });
      instance.current = map;
      map.touchZoomRotate.disableRotation();
      map.getCanvas().setAttribute('aria-label', 'Activity route map. Use arrow keys to pan and plus or minus to zoom.');
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
      map.on('load', () => {
        if (stopped || !map) return;
        map.addSource('activity-route', { type: 'geojson', data: {
          type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points.map(([lat, lng]) => [lng, lat]) },
        } });
        map.addLayer({ id: 'activity-route', type: 'line', source: 'activity-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#E48A6C', 'line-width': 4, 'line-opacity': 0.98 },
        });
        map.resize(); setLoading(false); setError('');
      });
      map.on('error', () => {
        if (!stopped) { setLoading(false); setError('The map could not load. Please try again.'); }
      });
    } catch {
      setLoading(false); setError('The interactive map could not start. Please try again or check that your browser supports WebGL.');
    }
    const observer = new ResizeObserver(() => map?.resize());
    observer.observe(container.current);
    return () => { stopped = true; observer.disconnect(); map?.remove(); instance.current = null; };
  }, [polyline, attempt]);

  function fitRoute() {
    const bounds = new mapboxgl.LngLatBounds();
    decodeRoute(polyline).forEach(([lat, lng]) => bounds.extend([lng, lat]));
    instance.current?.fitBounds(bounds, { padding: 48, maxZoom: 16, duration: 0 });
  }

  return <div className="mn-interactive-route relative h-full w-full bg-movenotes-map"
    onTouchStart={event => event.stopPropagation()} onTouchMove={event => event.stopPropagation()}
    onTouchEnd={event => event.stopPropagation()} onTouchCancel={event => event.stopPropagation()}>
    <div ref={container} style={{ position: 'absolute', inset: 0 }} />
    {loading && <p role="status" className="absolute left-3 top-3 rounded-lg bg-movenotes-bg/95 px-3 py-2 text-sm">Loading interactive map…</p>}
    {error && <div role="alert" className="absolute left-3 right-14 top-3 rounded-xl bg-movenotes-bg/95 p-3 text-sm shadow-sm"><p>{error}</p><button type="button" className="min-h-11 text-movenotes-primary underline" onClick={() => setAttempt(value => value + 1)}>Retry map</button></div>}
    {!loading && !error && <button type="button" aria-label="Fit activity route" title="Fit activity route" onClick={fitRoute} className="absolute right-[10px] top-28 flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-white text-movenotes-primary shadow"><IconFocus2 size={21} aria-hidden="true" /></button>}
  </div>;
}
