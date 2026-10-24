import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ActivityPhoto } from '../lib/photos';

export default function MemoryHighlightPhotos({ photos, urls, onOpen }: {
  photos: ActivityPhoto[]; urls: Record<string, string>; onOpen: (photoId: string) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  const move = (next: number) => {
    const element = track.current;
    if (element) element.scrollTo({ left: Math.max(0, Math.min(photos.length - 1, next)) * element.clientWidth });
  };
  if (!photos.length) return null;
  return <div role="group" aria-label="Highlight photos">
    <div ref={track} className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      onScroll={event => { const el = event.currentTarget; if (el.clientWidth) setIndex(Math.max(0, Math.min(photos.length - 1, Math.round(el.scrollLeft / el.clientWidth)))); }}
      onKeyDown={event => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault();
          const next = Math.max(0, Math.min(photos.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
          move(next);
          event.currentTarget.querySelectorAll('button')[next]?.focus({ preventScroll: true });
        }
      }}>
      {photos.map((photo, position) => {
        const path = photo.image_path || photo.thumb_path;
        return <button key={photo.id} type="button" aria-label={`Open highlight photo ${position + 1}`}
          className="w-full shrink-0 snap-center aspect-[4/3] max-h-80 bg-movenotes-bg"
          onClick={() => onOpen(photo.id)}>
          {path && urls[path] && !failed.includes(path)
            ? <img src={urls[path]} alt={`Activity photo ${position + 1}`} loading="lazy" className="w-full h-full object-contain"
              onError={() => setFailed(previous => [...previous, path])} />
            : <span className="text-sm text-movenotes-muted">Photo unavailable</span>}
        </button>;
      })}
    </div>
    {photos.length > 1 && <div className="flex items-center justify-between px-3 pt-1">
      <button type="button" aria-label="Previous highlight photo" disabled={index === 0} className="p-3 disabled:opacity-30" onClick={() => move(index - 1)}><ChevronLeft size={20} aria-hidden="true" /></button>
      <span role="status" className="text-xs text-movenotes-muted">{index + 1} / {photos.length}</span>
      <button type="button" aria-label="Next highlight photo" disabled={index === photos.length - 1} className="p-3 disabled:opacity-30" onClick={() => move(index + 1)}><ChevronRight size={20} aria-hidden="true" /></button>
    </div>}
  </div>;
}
