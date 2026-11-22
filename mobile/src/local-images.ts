/** Bridge local HTTP storage images into blob URLs for the HTTPS WebView. */
export function isLocalStorageImage(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === 'http://10.0.2.2:54321' && /^\/storage\/v1\/(object|render\/image)\/(sign|public)\//.test(url.pathname);
  } catch { return false; }
}
export function installLocalImages() {
  const active = new Map<HTMLImageElement, { source: string; controller: AbortController; blob?: string }>();
  const release = (image: HTMLImageElement) => {
    const state = active.get(image);
    if (!state) return;
    state.controller.abort();
    if (state.blob) URL.revokeObjectURL(state.blob);
    active.delete(image);
  };
  const visit = (image: HTMLImageElement) => {
    const source = image.getAttribute('src') || '';
    const previous = active.get(image);
    if (previous && (source === previous.source || source === previous.blob)) return;
    release(image);
    if (!isLocalStorageImage(source)) return;
    const state = { source, controller: new AbortController(), blob: undefined as string | undefined };
    active.set(image, state);
    void fetch(source, { signal: state.controller.signal, credentials: 'omit' }).then(async response => {
      if (!response.ok) throw new Error('Local image unavailable');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('Unexpected local image type');
      if (active.get(image) !== state || !image.isConnected) return;
      state.blob = URL.createObjectURL(blob);
      image.src = state.blob;
    }).catch(() => { /* Preserve existing image error handling. */ });
  };
  const scan = () => {
    for (const image of active.keys()) if (!image.isConnected) release(image);
    document.querySelectorAll('img').forEach(visit);
  };
  new MutationObserver(scan).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src'] });
  scan();
}
