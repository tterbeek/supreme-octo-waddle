import { useEffect, useRef, useState } from 'react';
import { IconBoxMultiple2, IconBoxMultiple3, IconBoxMultiple4, IconBoxMultiple5, IconBoxMultiple6, IconBoxMultiple7, IconBoxMultiple8, IconBoxMultiple9 } from '@tabler/icons-react';

/** Journal and shared cards use the same first-photo preview and gallery count. */
export default function ActivityPhotoPreview({ src, count, onOpen, onLoad, onError, alt = 'Activity note', label = 'Open activity photos', loading = 'lazy' }: {
  src: string; count: number; onOpen: () => void;
  onLoad?: (width: number, height: number) => void; onError?: () => void;
  alt?: string; label?: string; loading?: 'lazy' | 'eager';
}) {
  const image = useRef<HTMLImageElement>(null);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;
  const [dimensions, setDimensions] = useState({ src: '', portrait: false });
  const loaded = dimensions.src === src;
  const handleLoad = (element: HTMLImageElement) => {
    if (!element.naturalWidth) return;
    setDimensions({ src, portrait: element.naturalHeight > element.naturalWidth });
    onLoadRef.current?.(element.naturalWidth, element.naturalHeight);
  };
  useEffect(() => {
    if (image.current?.complete && image.current.naturalWidth) {
      const element = image.current;
      setDimensions({ src, portrait: element.naturalHeight > element.naturalWidth });
      onLoadRef.current?.(element.naturalWidth, element.naturalHeight);
    }
  }, [src]);
  const CountIcon = count > 1 ? [IconBoxMultiple2, IconBoxMultiple3, IconBoxMultiple4, IconBoxMultiple5, IconBoxMultiple6, IconBoxMultiple7, IconBoxMultiple8, IconBoxMultiple9][Math.min(count, 9) - 2] : null;
  return <button type="button" aria-label={label} className="relative inline-block max-w-full" data-photo-trigger="true" data-swipe-ignore="true"
    onPointerDown={event => event.stopPropagation()}
    onClick={event => { event.stopPropagation(); if (count > 0) onOpen(); }}>
    <img ref={image} src={src} alt={alt} loading={loading} onLoad={event => handleLoad(event.currentTarget)} onError={onError}
      className={`rounded-xl border border-warm-200 shadow-sm transition-opacity duration-200 ${dimensions.portrait ? 'max-h-60 w-auto max-w-full mx-auto object-contain' : 'w-full max-h-56 object-cover'} ${loaded ? 'opacity-100' : 'opacity-0'}`} />
    {CountIcon && <span aria-label={`${count} photos`} className="absolute bottom-2 right-2 rounded-full bg-black/70 text-white text-[11px] font-semibold px-2 py-0.5"><CountIcon size={14} strokeWidth={2}/></span>}
  </button>;
}
