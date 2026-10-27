import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { IconChevronDown, IconDotsVertical, IconSend2 } from '@tabler/icons-react';
import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { ACTIVITY_TYPES } from '../../config/activityTypes';
import { socialPhoto, socialConversation, socialHistory, socialCommentAvatar, type SocialActivity, type SocialComment, type Conversation } from '../../services/social.service';
import CommentActions from './CommentActions';
import { SOCIAL_UPDATED_EVENT } from '../../config/social';
import { formatDistance, formatDurationMinutes } from '../../lib/units';
import { useUnitSystem } from '../../contexts/UnitContext';
import { useFormLeave } from '../../hooks/useFormLeave';
import GalleryLightbox from '../GalleryLightbox';
import DialogSheet from '../DialogSheet';
import FormTextarea from '../forms/FormTextarea';
import { DiscardPrompt } from '../forms/FormLayout';
import AppreciationButton from './AppreciationButton';
import ActivitySharingSheet from './ActivitySharingSheet';

function ProfileImage({ name, url, onError }: { name: string; url?: string; onError: () => void }) {
  return url ? <img src={url} alt={`${name}'s profile picture`} className="h-10 w-10 shrink-0 rounded-full border border-warm-300/60 object-cover" onError={onError} />
    : <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-movenotes-primary/15 font-semibold text-movenotes-primary">{name.slice(0, 1).toUpperCase()}</span>;
}

export default function SocialActivityCard({ activity, onConversation, viewerId }: { activity: SocialActivity; onConversation: () => void; viewerId?: string }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [active, setActive] = useState<number | null>(null);
  const [discussion, setDiscussion] = useState<Conversation | null>(null);
  const [selectedComment, setSelectedComment] = useState<SocialComment | null>(null);
  const [visibleComments, setVisibleComments] = useState(3);
  const [readingComments, setReadingComments] = useState(false);
  const [refreshComments, setRefreshComments] = useState(0);
  const commentPages = Math.ceil(visibleComments / 100);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [appreciating, setAppreciating] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [sharingOpen, setSharingOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const card = useRef<HTMLElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sequence = useRef(0);
  const commentId = useId();
  const leave = useFormLeave(!!body.trim(), busy || appreciating, () => setBody(''));
  const context = activity.contexts[0]?.id;
  const photoKey = activity.photos.map(p => p.id).join(',');
  const { unitSystem } = useUnitSystem();

  useEffect(() => {
    if (!card.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '200px' });
    observer.observe(card.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setUrls({});
    if (!context) return;
    const load = async () => {
      const pairs = await Promise.all(['profile', ...photoKey.split(',').filter(Boolean)].map(async id => {
        try { return [id, await socialPhoto(context, id)]; } catch { return [id, '']; }
      }));
      if (!cancelled) setUrls(Object.fromEntries(pairs));
    };
    const visibility = () => { if (document.visibilityState === 'visible') void load(); else setUrls({}); };
    void load();
    const timer = window.setInterval(visibility, 45_000);
    document.addEventListener('visibilitychange', visibility);
    return () => { cancelled = true; window.clearInterval(timer); document.removeEventListener('visibilitychange', visibility); };
  }, [context, photoKey]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const load = async () => {
      const current = ++sequence.current;
      setReadingComments(true);
      try {
        const result = await socialHistory(activity.id, commentPages);
        if (!cancelled && current === sequence.current) { setDiscussion(result); setLoadError(''); }
      } catch {
        if (!cancelled && current === sequence.current) { setDiscussion(null); setLoadError('Comments are unavailable. Open the conversation to try again.'); }
      }
      finally { if (!cancelled && current === sequence.current) setReadingComments(false); }
    };
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    void load();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener(SOCIAL_UPDATED_EVENT, refresh);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener(SOCIAL_UPDATED_EVENT, refresh); };
  }, [activity.id, visible, commentPages, refreshComments]);

  const preview = discussion?.comments.slice(-visibleComments) || [];
  const avatarAuthors = preview.filter(c => c.has_avatar).map(c => c.author_id).filter((id, index, all) => all.indexOf(id) === index).sort().join(',');
  useEffect(() => {
    let cancelled = false;
    setAvatars({});
    if (!visible || !avatarAuthors) return;
    const load = async () => {
      const pairs = await Promise.all(avatarAuthors.split(',').map(async author => {
        try { return [author, await socialCommentAvatar(activity.id, author)]; } catch { return [author, '']; }
      }));
      if (!cancelled) setAvatars(Object.fromEntries(pairs));
    };
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); else setAvatars({}); }, 45_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activity.id, avatarAuthors, visible]);

  useEffect(() => {
    if (!menuOpen) return;
    menu.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus();
    const outside = (event: PointerEvent) => { if (!menu.current?.contains(event.target as Node)) setMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [menuOpen]);

  const post = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || appreciating || !body.trim()) return;
    setBusy(true); setError(''); ++sequence.current;
    try { setDiscussion(await socialConversation(activity.id, 'comment', { body })); setBody(''); setRefreshComments(n=>n+1); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); setReadingComments(false); }
  };
  const appreciate = async () => {
    if (!discussion || busy || appreciating) return;
    setAppreciating(true); setError(''); ++sequence.current;
    try { setDiscussion(await socialConversation(activity.id, 'reaction', { reaction: discussion.my_reaction === 'CHEER' ? null : 'CHEER' })); setRefreshComments(n=>n+1); }
    catch (e) { setError((e as Error).message); }
    finally { setAppreciating(false); setReadingComments(false); }
  };
  const openConversation = () => leave.request(() => { setBody(''); onConversation(); });
  const config = ACTIVITY_TYPES[activity.type] || ACTIVITY_TYPES.other;
  const items = activity.photos.map(p => ({ key: p.id, activity: { id: activity.id, title: activity.title, type: activity.type, date: activity.date, notes: activity.public_note }, imagePath: null, thumbPath: null, photoId: p.id }));
  const count = discussion?.comment_count ?? activity.comment_count ?? 0;
  const appreciated = discussion?.my_reaction === 'CHEER';
  const othersAppreciated = !!discussion && (discussion.reactions.find(r => r.reaction === 'CHEER')?.count || 0) > (appreciated ? 1 : 0);
  const date = parseISO(activity.date);
  const dateLabel = Number.isNaN(date.getTime()) ? activity.date : format(date, 'EEE d MMM');

  return <article ref={card} aria-label={`Shared activity: ${activity.title || config.label}`} className="rounded-2xl border border-warm-200 bg-white/25 p-4 sm:p-6">
    <header className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3 text-sm">
        <ProfileImage name={activity.author} url={urls.profile} onError={() => setUrls(previous => ({ ...previous, profile: '' }))} />
        <p className="min-w-0 break-words"><span className="font-semibold">{activity.author}</span><span className="mx-2 text-movenotes-muted">·</span><time dateTime={activity.date} className="text-movenotes-muted">{dateLabel}</time></p>
      </div>
      {activity.author_id===viewerId&&<div ref={menu} className="relative shrink-0" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false); }}>
        <button ref={menuButton} type="button" aria-label="Shared activity options" aria-haspopup="menu" aria-expanded={menuOpen} className="rounded-full p-3 text-gray-500 hover:bg-white/50" onClick={() => setMenuOpen(open => !open)}><IconDotsVertical size={18} /></button>
        {menuOpen && <div role="menu" className="absolute right-0 top-full z-10 w-52 rounded-xl border border-warm-200 bg-warm-100 p-1 shadow-lg"><button role="menuitem" type="button" className="w-full rounded-lg px-3 py-3 text-left text-sm hover:bg-white/60" onClick={() => { setMenuOpen(false); leave.request(()=>{setBody('');setSharingOpen(true);}); }}>Modify sharing</button></div>}
      </div>}
    </header>
    <div className="space-y-4 py-6 text-center sm:py-7">
      <h2 className="flex items-start justify-center gap-3 text-lg font-semibold sm:text-xl"><span className="mt-0.5 shrink-0"><config.Icon size={26} /></span><span className="min-w-0 [overflow-wrap:anywhere]">{activity.title || config.label}</span></h2>
      <p className="text-sm text-gray-500">{[activity.distance_km != null ? formatDistance(activity.distance_km, unitSystem) : null, activity.duration_min != null ? formatDurationMinutes(activity.duration_min) : null].filter(Boolean).join(' · ')}</p>
      {activity.public_note && <p className="whitespace-pre-wrap break-words font-playfair text-[15px] md:text-[17px] italic leading-relaxed text-gray-600">{activity.public_note}</p>}
      {!!activity.photos.length && <div className={`mx-auto grid max-w-lg gap-3 pt-2 ${activity.photos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {activity.photos.map((p, i) => <button key={p.id} type="button" aria-label={`Open shared photo ${i + 1}`} onClick={() => setActive(i)} className="flex min-w-0 items-center justify-center overflow-hidden rounded-2xl">
          {urls[p.id] ? <img src={urls[p.id]} alt="Shared activity" onError={() => setUrls(previous => ({ ...previous, [p.id]: '' }))} className={`block w-auto max-w-full rounded-2xl object-contain ${activity.photos.length > 1 ? 'max-h-72' : 'max-h-[28rem]'}`} /> : <span className="flex min-h-40 items-center text-sm text-movenotes-muted">Photo unavailable</span>}
        </button>)}
      </div>}
    </div>
    <section className="space-y-4 border-t border-gray-300/60 pt-4" aria-label="Activity comments">
      <p className="text-xs text-movenotes-muted break-words">Shared with {activity.contexts.map(c => c.name).join(' · ')}</p>
      <div className="flex flex-wrap items-center gap-3"><h3 className="font-semibold"><button type="button" aria-label="Open activity conversation" onClick={openConversation}>Comments</button> <span className="ml-1 text-sm font-normal text-movenotes-muted">{count}</span></h3>
        <AppreciationButton appreciated={appreciated} othersAppreciated={othersAppreciated} disabled={!discussion || busy || appreciating} onToggle={()=>void appreciate()} />
      </div>
      <div className="space-y-4">{preview.map(c => <button type="button" key={c.id} data-comment-id={c.id} aria-label={`Actions for comment by ${c.author}`} className="flex w-full items-start gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-movenotes-primary/40" onClick={()=>setSelectedComment(c)}>
        <ProfileImage name={c.author} url={avatars[c.author_id]} onError={() => setAvatars(previous => ({ ...previous, [c.author_id]: '' }))} />
        <div className="min-w-0 flex-1 text-sm"><p className="flex flex-wrap items-baseline gap-x-2"><span className="font-semibold break-words">{c.author}</span><span className="text-movenotes-muted">·</span><time dateTime={c.created_at} title={new Date(c.created_at).toLocaleString()} className="text-xs text-movenotes-muted">{Number.isNaN(Date.parse(c.created_at)) ? '' : formatDistanceToNowStrict(new Date(c.created_at), { addSuffix: true })}</time></p><p className="whitespace-pre-wrap break-words leading-relaxed">{c.body}</p></div>
      </button>)}</div>
      {count > preview.length && <button type="button" disabled={readingComments} className="inline-flex min-h-11 items-center gap-2 text-sm text-movenotes-primary disabled:opacity-50" onClick={()=>setVisibleComments(n=>n+5)}>View more comments<IconChevronDown size={18} /></button>}
      <form onSubmit={post} className="space-y-2" aria-label="Write a comment">
        <label htmlFor={commentId} className="sr-only">Write a comment</label>
        <div className="flex items-end gap-2 rounded-2xl border border-gray-300/70 bg-white/20 px-3 py-1 focus-within:ring-2 focus-within:ring-movenotes-primary/30">
          <FormTextarea id={commentId} rows={1} maxLength={1000} value={body} disabled={busy} onChange={event => setBody(event.target.value)} placeholder="Write a comment…" className="min-h-11 w-full min-w-0 border-0 bg-transparent py-3 text-base outline-none placeholder:text-gray-400" />
          <button type="submit" aria-label="Send comment" disabled={busy || appreciating || !body.trim()} className="mb-0.5 flex min-h-11 min-w-11 items-center justify-center rounded-full text-movenotes-primary disabled:text-gray-400 disabled:opacity-50"><IconSend2 size={22} /></button>
        </div>
        <p className="text-xs leading-relaxed text-movenotes-muted">Comments are visible to everyone this activity is shared with.</p>
        {busy && <p role="status" className="sr-only">Sending comment…</p>}
        {(error || loadError) && <p role="alert" className="text-sm text-red-700">{error || loadError}</p>}
      </form>
    </section>
    {leave.confirm && <DialogSheet title="Unsaved comment" onClose={leave.keep}><DiscardPrompt keep={leave.keep} discard={() => { setBody(''); leave.discard(); }} /></DialogSheet>}
    {selectedComment && <CommentActions activityId={activity.id} comment={selectedComment} onClose={()=>setSelectedComment(null)} onUpdated={value=>{++sequence.current;setDiscussion(value);setRefreshComments(n=>n+1);}}/>}
    {sharingOpen && <ActivitySharingSheet activityId={activity.id} onClose={()=>setSharingOpen(false)}/>}
    <GalleryLightbox open={active !== null} items={items} activeIndex={active || 0} onActiveIndexChange={setActive} onClose={() => setActive(null)} signedImages={urls} signedThumbs={urls} />
  </article>;
}
