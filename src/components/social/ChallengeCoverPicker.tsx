import { useEffect, useId, useRef, useState } from 'react';
import { IconCamera } from '@tabler/icons-react';
import { socialChallengeCover, type Challenge } from '../../services/social.service';

export default function ChallengeCoverPicker({ challenge, file, removed, onFile, onRemove }: {
  challenge?: Challenge; file: File | null; removed: boolean;
  onFile: (file: File) => void; onRemove: () => void;
}) {
  const id = useId(); const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  useEffect(() => {
    let cancelled = false;
    setUrl('');
    if (file) { const preview = URL.createObjectURL(file); setUrl(preview); return () => URL.revokeObjectURL(preview); }
    if (!challenge?.has_cover || removed) return;
    const load = () => void socialChallengeCover(challenge.id).then(value => { if (!cancelled) setUrl(value); }).catch(() => { if (!cancelled) setUrl(''); });
    load(); const timer = window.setInterval(load, 45_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [file, removed, challenge?.id, challenge?.has_cover]);
  return <div className="mn-field space-y-3">
    <label htmlFor={id}>Cover image (optional)</label>
    {url && <img src={url} alt="Challenge cover preview" className="aspect-[2.7/1] w-full rounded-xl object-cover" />}
    <input ref={input} id={id} type="file" accept="image/*" className="sr-only" onChange={event => { const next = event.target.files?.[0]; if (next) onFile(next); event.target.value = ''; }} />
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm" onClick={() => input.current?.click()}><IconCamera size={18} />{url ? 'Change cover' : 'Choose cover'}</button>
      {(file || challenge?.has_cover) && !removed && <button type="button" className="min-h-11 underline text-sm" onClick={onRemove}>Remove cover</button>}
    </div>
  </div>;
}
