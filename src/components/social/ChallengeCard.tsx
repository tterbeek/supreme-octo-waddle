import { useEffect, useRef, useState } from 'react';
import { IconCalendar, IconCamera, IconChevronRight, IconCircleCheckFilled } from '@tabler/icons-react';
import { format, parseISO, subDays } from 'date-fns';
import { ACTIVITY_TYPES } from '../../config/activityTypes';
import { socialChallengeCover, type Challenge } from '../../services/social.service';
import { saveChallengeWithCover } from '../../services/challengeCover.service';
import ChallengeActions from './ChallengeActions';
import ModalSheet from '../ModalSheet';

export default function ChallengeCard({ challenge, community, canManage, onUpdate, onChanged }: {
  challenge: Challenge; community: string; canManage: boolean; onUpdate: () => void; onChanged: () => void;
}) {
  const [cover, setCover] = useState(''); const [coverVersion, setCoverVersion] = useState(0);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [details, setDetails] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let cancelled = false; setCover('');
    if (!challenge.has_cover) return;
    const load = () => void socialChallengeCover(challenge.id).then(value => { if (!cancelled) setCover(value); }).catch(() => { if (!cancelled) setCover(''); });
    load(); const timer = window.setInterval(load, 45_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [challenge.id, challenge.has_cover, challenge.cover_updated_at, coverVersion]);
  const upload = async (file: File) => {
    setBusy(true); setError('');
    try { await saveChallengeWithCover(community, 'cover', { id: challenge.id }, file); setCoverVersion(n => n + 1); onChanged(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const value = Number(challenge.scope === 'collective' ? challenge.total : challenge.mine);
  const target = Number(challenge.target);
  const percent = target > 0 ? Math.max(0, Math.min(100, value / target * 100)) : 0;
  const reached = value >= target && target > 0 && ['active', 'completed'].includes(challenge.state);
  const unit = challenge.metric === 'distance' ? 'km' : challenge.metric === 'duration' ? 'min' : challenge.metric === 'days' ? 'active dates' : 'activities';
  const quantity = (number: number) => number.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const first = parseISO(challenge.starts_on); const last = subDays(parseISO(challenge.ends_on), 1);
  const dateRange = `${format(first, first.getFullYear() === last.getFullYear() ? 'd MMM' : 'd MMM yyyy')} – ${format(last, 'd MMM yyyy')}`;
  const state = reached ? 'Goal reached' : challenge.state === 'active' ? null : challenge.state === 'upcoming' ? 'Upcoming' : challenge.state === 'cancelled' ? 'Cancelled' : 'Completed';
  const types = challenge.types.length ? challenge.types.map(type => ACTIVITY_TYPES[type]).filter(Boolean) : [];
  return <article aria-label={`Challenge: ${challenge.title}`} className="overflow-hidden rounded-2xl border border-warm-200 bg-white/25">
    {(challenge.has_cover || canManage) && <div className={`relative ${challenge.has_cover ? 'aspect-[2.7/1] bg-movenotes-primary/10' : 'flex justify-end px-4 pt-4 sm:px-6'}`}>
      {cover && <img src={cover} alt={`${challenge.title} cover`} className="h-full w-full object-cover" onError={() => setCover('')} />}
      {canManage && <button type="button" disabled={busy} onClick={() => input.current?.click()} className={`${challenge.has_cover ? 'absolute right-3 top-3 sm:right-4 sm:top-4' : ''} inline-flex min-h-11 items-center gap-2 rounded-full border border-warm-200 bg-warm-50/70 px-4 text-sm text-movenotes-primary disabled:opacity-50`}><IconCamera size={18} />{busy ? 'Saving cover…' : challenge.has_cover ? 'Change cover' : 'Add cover'}</button>}
      {canManage && <input ref={input} type="file" accept="image/*" aria-label="Challenge cover image" className="sr-only" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ''; }} />}
    </div>}
    <div className="space-y-5 p-4 sm:space-y-6 sm:p-6">
      <div className="flex items-start justify-between gap-3"><h3 className="min-w-0 break-words text-2xl font-bold leading-tight sm:text-3xl">{challenge.title}</h3>{canManage && <ChallengeActions onUpdate={onUpdate} />}</div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-gray-500"><IconCalendar size={22} className="shrink-0" />{dateRange}</p>
        {state && <span className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${reached ? 'bg-movenotes-primary/10 text-movenotes-primary' : 'bg-gray-200/40 text-gray-500'}`}>{reached && <IconCircleCheckFilled size={23} />}{state}</span>}
      </div>
      <div className="space-y-3 rounded-2xl bg-movenotes-primary/[0.07] p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><p className="min-w-0 break-words text-4xl font-bold leading-tight text-movenotes-primary sm:text-5xl">{quantity(value)} <span className="text-2xl sm:text-3xl">{unit}</span></p><span className="text-sm text-gray-500">{challenge.scope === 'collective' ? 'Together' : 'Your progress'}</span></div>
        <p className="text-sm text-gray-500">{challenge.scope === 'collective' ? 'Our goal' : 'Your goal'}: {quantity(target)} {unit}</p>
        <div className="relative pt-4">
          {reached && <svg viewBox="0 0 48 64" aria-hidden="true" className="pointer-events-none absolute -top-10 right-0 h-16 w-12 text-movenotes-accent">
            <path d="M10 14 6 9M24 9 26 3M39 15 43 9M9 26 3 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M20 20V55" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            <path d="M20 18 42 28 20 39Z" fill="currentColor" />
          </svg>}
          <div role="progressbar" aria-label="Challenge progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${quantity(value)} of ${quantity(target)} ${unit}`} className="h-3.5 overflow-hidden rounded-full bg-movenotes-primary/10"><div style={{ width: `${percent}%` }} className="h-full rounded-full bg-movenotes-primary/80" /></div>
        </div>
      </div>
      {!!types.length && <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">{types.map(type => <span key={type.id} className="inline-flex items-center gap-2"><span className="text-movenotes-accent"><type.Icon size={20} /></span>{type.label}</span>)}</div>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-gray-300/50 pt-3 text-xs text-movenotes-muted">
        <p>Only activities shared with this community count.</p>
        <button type="button" className="inline-flex min-h-11 items-center gap-1 text-sm text-movenotes-text" onClick={() => setDetails(true)}>Challenge details<IconChevronRight size={18} /></button>
      </footer>
    </div>
    {details && <ModalSheet title="Challenge details" onClose={() => setDetails(false)}><div className="space-y-4">
      <h3 className="text-lg font-semibold break-words">{challenge.title}</h3>
      <p>{dateRange} · {challenge.time_zone}</p>
      <p>{challenge.scope === 'collective' ? 'Collective target' : 'Personal target'}: {quantity(target)} {unit}</p>
      <p>{challenge.types.length ? types.map(type => type.label).join(' · ') : 'All activity types'}</p>
      <p className="text-sm text-movenotes-muted">All Community members are included. Only eligible activities shared here count; private activities stay private. Totals update after edits, unsharing or leaving the Community.</p>
    </div></ModalSheet>}
  </article>;
}
