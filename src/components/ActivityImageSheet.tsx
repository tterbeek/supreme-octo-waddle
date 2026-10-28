import { useEffect, useId, useRef, useState } from "react";
import DialogSheet from "./DialogSheet";
import { FormActions } from "./forms/FormLayout";
import { useUnitSystem } from "../contexts/UnitContext";
import { loadActivityImageMap, loadActivityImagePhoto, loadOwnedActivityImage } from "../services/activityImage.service";
import { signStorageValues } from "../services/storage.service";
import { canShareActivityImage, createPreparationGate, saveActivityImage, shareActivityImage } from "../lib/activityImage";
import { renderActivityImage } from "../lib/renderActivityImage";

import { mapboxToken } from '../lib/mapbox';
import { loadPolarRoute } from '../services/activityRoute.service';
import { IconMap2 } from '@tabler/icons-react';

const MAP = '__map__';
type Details = Awaited<ReturnType<typeof loadOwnedActivityImage>>;

export default function ActivityImageSheet({ activityId, onClose }: { activityId: string; onClose: () => void }) {
  const { unitSystem } = useUnitSystem();
  const identity = `${activityId}:${unitSystem}`;
  const [details, setDetails] = useState<{ identity: string; value: Details } | null>(null);
  const [selection, setSelection] = useState<string | null>(null);
  const [hideEndpoints, setHideEndpoints] = useState(true);
  const hideLabelId = useId();
  const routeCache = useRef(new Map<string, string | null>());
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [retry, setRetry] = useState(0);
  const [loadRetry, setLoadRetry] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const sharingRef = useRef(false);
  const gate = useRef(createPreparationGate());
  const [prepared, setPrepared] = useState<{ file: File; url: string; identity: string; selection: string | null; hideEndpoints: boolean } | null>(null);
  const currentDetails = details?.identity === identity ? details.value : null;
  const ready = prepared?.identity === identity && prepared.selection === selection && (selection !== MAP || prepared.hideEndpoints === hideEndpoints) ? prepared : null;
  const canUseMap = Boolean(currentDetails && mapboxToken.startsWith('pk.') && (
    currentDetails.route.polyline || (currentDetails.route.source === 'polar' && !currentDetails.route.checkedAt)
  ));
  const nativeShare = ready ? canShareActivityImage(ready.file) : false;

  useEffect(() => {
    let cancelled = false;
    setDetails(null); setSelection(null); setHideEndpoints(true); routeCache.current.clear(); setLoadError(null); setThumbnails({});
    void loadOwnedActivityImage(activityId, unitSystem).then(value => {
      if (cancelled) return;
      setDetails({ identity, value });
      const paths = value.photos.map(photo => photo.thumb_path || photo.image_path).filter((path): path is string => Boolean(path));
      void signStorageValues(paths).then(urls => { if (!cancelled) setThumbnails(urls); }).catch(() => { /* Numbered choices still work without thumbnails. */ });
    }).catch(() => { if (!cancelled) setLoadError("Couldn't load your activity. Try again."); });
    return () => { cancelled = true; };
  }, [activityId, unitSystem, identity, loadRetry]);

  useEffect(() => {
    const preparation = gate.current;
    const ticket = preparation.next();
    let url: string | null = null;
    const controller = new AbortController();
    setPrepared(null); setPrepareError(null); setShareError(null);
    if (!currentDetails) return () => preparation.cancel();
    void (async () => {
      let blob: Blob | undefined;
      if (selection === MAP) {
        let route = currentDetails.route.polyline;
        if (!route && currentDetails.route.source === 'polar' && !currentDetails.route.checkedAt) {
          if (!routeCache.current.has(activityId)) routeCache.current.set(activityId, await loadPolarRoute(activityId));
          route = routeCache.current.get(activityId) ?? null;
        }
        if (!route) throw new Error('No GPS route is available for this activity. Choose another image.');
        if (!preparation.isCurrent(ticket)) return;
        blob = await loadActivityImageMap(route, hideEndpoints, controller.signal);
      } else {
        const photo = selection ? currentDetails.photos.find(item => item.id === selection) : null;
        if (selection && !photo?.image_path) throw new Error('Photo unavailable');
        blob = photo?.image_path ? await loadActivityImagePhoto(photo.image_path) : undefined;
      }
      if (!preparation.isCurrent(ticket)) return;
      const file = await renderActivityImage(currentDetails.model, blob, selection === MAP ? 'map' : 'photo');
      if (!preparation.isCurrent(ticket)) return;
      url = URL.createObjectURL(file);
      setPrepared({ file, url, identity, selection, hideEndpoints });
    })().catch((error: unknown) => {
      if (preparation.isCurrent(ticket)) setPrepareError(selection === MAP && error instanceof Error ? error.message : selection
        ? "Couldn't prepare this photo. Retry or choose No image."
        : "Couldn't prepare the image. Check your connection and retry.");
    });
    return () => { preparation.cancel(); controller.abort(); if (url) URL.revokeObjectURL(url); };
  }, [currentDetails, identity, selection, retry, hideEndpoints, activityId]);

  const share = async () => {
    if (!ready || sharingRef.current) return;
    sharingRef.current = true; setSharing(true); setShareError(null);
    try {
      // Prepared before this click: preserve the browser's transient user activation.
      const result = await shareActivityImage(ready.file);
      if (result === "failed") setShareError("Couldn't share the image. Try again or save it instead.");
      if (result === "unsupported") setShareError("Sharing isn't available here. Save the image instead.");
      // Cancellation is quiet. Resolution is not proof of delivery.
    } finally { sharingRef.current = false; setSharing(false); }
  };

  return <DialogSheet title="Share as image" busy={sharing} onClose={onClose}>
    <div className="space-y-4 pb-[env(safe-area-inset-bottom)]">
      <p className="text-sm text-gray-600">Only what’s shown here is included. Personal notes stay private.</p>
      <p className="text-xs text-gray-500">People you send it to can save or forward it.</p>
      {currentDetails && (currentDetails.photos.length > 0 || canUseMap) && <fieldset disabled={sharing}>
        <legend className="text-sm text-gray-600 mb-2">Image</legend>
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button type="button" aria-pressed={selection === null} onClick={() => setSelection(null)} className={`shrink-0 rounded-lg border px-3 py-2 text-sm ${selection === null ? "border-movenotes-primary bg-white" : "border-warm-200"}`}>No image</button>
          {canUseMap && <button type="button" aria-pressed={selection === MAP} onClick={() => setSelection(MAP)} className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm ${selection === MAP ? 'border-movenotes-primary bg-white' : 'border-warm-200'}`}><IconMap2 size={20} aria-hidden="true" />Map</button>}
          {currentDetails.photos.map((photo, index) => {
            const thumb = thumbnails[photo.thumb_path || photo.image_path || ""];
            return <button key={photo.id} type="button" aria-label={`Use photo ${index + 1}`} aria-pressed={selection === photo.id}
              disabled={!photo.image_path} onClick={() => setSelection(photo.id)}
              className={`shrink-0 w-14 h-14 rounded-lg border-2 overflow-hidden text-xs disabled:opacity-50 ${selection === photo.id ? "border-movenotes-primary" : "border-transparent"}`}>
              {thumb ? <img src={thumb} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" /> : `Photo ${index + 1}`}
            </button>;
          })}
        </div>
      </fieldset>}
      {selection === MAP && <div className="space-y-1 rounded-xl border border-warm-200 p-3">
        <div className="flex items-center justify-between gap-3">
          <span id={hideLabelId} className="text-sm text-gray-700">Hide start and finish</span>
          <button type="button" role="switch" aria-labelledby={hideLabelId} aria-checked={hideEndpoints} disabled={sharing} onClick={() => setHideEndpoints(value => !value)} className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${hideEndpoints ? 'bg-movenotes-primary/70' : 'bg-gray-300/70'}`}>
            <span aria-hidden="true" className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${hideEndpoints ? 'translate-x-4' : 'translate-x-1'}`} />
          </button>
        </div>
        <p className="text-xs text-gray-500">{hideEndpoints ? 'Hides route sections within about 500 m of the start and finish, including return visits. The surrounding area may still be recognizable.' : 'The full route, including the start and finish, will be included.'}</p>
      </div>}
      <div aria-live="polite" aria-busy={!ready && !loadError && !prepareError}>
        {ready ? <img src={ready.url} alt="Prepared activity image, including MoveNotes branding and https://movenotes.app" className="w-full max-w-sm mx-auto rounded-xl border border-warm-200" />
          : !loadError && !prepareError ? <p className="py-8 text-center text-sm text-gray-500" role="status">Preparing image…</p> : null}
        {(loadError || prepareError) && <div role="alert" className="rounded-xl border border-warm-200 p-4 text-sm text-gray-700">
          <p>{loadError || prepareError}</p>
          <button type="button" className="mt-2 underline text-movenotes-primary" onClick={() => loadError ? setLoadRetry(value => value + 1) : setRetry(value => value + 1)}>Retry</button>
        </div>}
      </div>
      {shareError && <p role="alert" className="text-sm text-gray-700">{shareError}</p>}
      <div className="space-y-2">
        {nativeShare && <>
          <FormActions><button type="button" disabled={!ready || sharing} onClick={() => void share()}>{sharing ? "Sharing…" : "Share image"}</button></FormActions>
          <p className="text-xs text-center text-gray-500">Choose WhatsApp or another app.</p>
        </>}
        {nativeShare ? <button type="button" disabled={!ready || sharing} onClick={() => { if (ready) saveActivityImage(ready.url); }} className="mn-form-cancel">Save image</button>
          : <FormActions><button type="button" disabled={!ready || sharing} onClick={() => { if (ready) saveActivityImage(ready.url); }}>Save image</button></FormActions>}
        {ready && !nativeShare && <p className="text-xs text-center text-gray-500">Save the image, then attach it in WhatsApp.</p>}
      </div>
    </div>
  </DialogSheet>;
}
