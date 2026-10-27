import { useEffect, useState } from 'react';
import { IconChevronRight, IconCircleCheckFilled, IconFlag } from '@tabler/icons-react';
import { socialChallengeCover, type Challenge } from '../../services/social.service';

export default function ChallengePreview({ challenge, communityName, onOpen }: {
  challenge: Challenge; communityName: string; onOpen: () => void;
}) {
  const [cover, setCover] = useState('');
  useEffect(() => {
    let cancelled = false;
    setCover('');
    if (!challenge.has_cover) return;
    const load = () => void socialChallengeCover(challenge.id).then(url => {
      if (!cancelled) setCover(url);
    }).catch(() => { if (!cancelled) setCover(''); });
    load();
    const timer = window.setInterval(load, 45_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [challenge.id, challenge.has_cover, challenge.cover_updated_at]);
  const actual = Number(challenge.scope === 'collective' ? challenge.total : challenge.mine);
  const target = Number(challenge.target);
  const percent = target > 0 ? Math.max(0, Math.min(100, actual / target * 100)) : 0;
  const reached = target > 0 && actual >= target && challenge.state !== 'upcoming';
  const unit = challenge.metric === 'distance' ? 'km' : challenge.metric === 'duration' ? 'min' : challenge.metric === 'days' ? 'active dates' : 'activities';
  const quantity = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return <button type="button" onClick={onOpen} aria-label={`${challenge.title} — ${communityName}`} className="flex w-full items-stretch gap-3 rounded-2xl border border-warm-200 bg-white/25 p-3 text-left transition-colors hover:bg-white/50 sm:gap-4 sm:p-4">
    <span className="relative flex min-h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-movenotes-primary/10 text-movenotes-primary sm:w-32">
      {cover ? <img src={cover} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setCover('')} /> : <IconFlag size={28} aria-hidden="true" />}
    </span>
    <span className="flex min-w-0 flex-1 flex-col justify-center gap-2 py-1">
      <span className="break-words text-xs text-movenotes-muted sm:text-sm">{communityName}</span>
      <span className="flex items-center justify-between gap-2"><span className="min-w-0 break-words text-base font-bold leading-tight sm:text-xl">{challenge.title}</span><IconChevronRight size={20} className="shrink-0 text-movenotes-muted" aria-hidden="true" /></span>
      <span role="progressbar" aria-label="Challenge progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${quantity(actual)} of ${quantity(target)} ${unit}`} className="mt-1 block h-2.5 overflow-hidden rounded-full bg-movenotes-primary/10"><span style={{ width: `${percent}%` }} className="block h-full rounded-full bg-movenotes-primary/80" /></span>
      <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs sm:text-sm">
        <span className="text-movenotes-muted"><strong className="font-semibold text-movenotes-primary">{quantity(actual)}</strong> / {quantity(target)} {unit}{challenge.scope === 'collective' ? ' together' : ''}</span>
        {reached ? <span className="inline-flex items-center gap-1 text-movenotes-primary"><IconCircleCheckFilled size={18} aria-hidden="true" />Goal reached</span> : challenge.state === 'upcoming' ? <span className="text-movenotes-muted">Upcoming</span> : null}
      </span>
    </span>
  </button>;
}
