import { useEffect, useState } from 'react';
import ModalSheet from '../ModalSheet';
import { FormError } from '../forms/FormLayout';
import { socialDeleteOwnComment, socialOwnComments, type OwnComments } from '../../services/social.service';

export default function OwnSocialComments({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<OwnComments | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void socialOwnComments().then(value => { if (!cancelled) setData(value); }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [retry]);
  const remove = async (id: string) => {
    setBusy(true); setError('');
    try { await socialDeleteOwnComment(id); setData(previous => previous && { ...previous, comments: previous.comments.filter(c => c.id !== id) }); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const older = async () => {
    setBusy(true); setError('');
    try { const next = await socialOwnComments(data?.before); setData(previous => ({ ...next, comments: [...(previous?.comments || []), ...next.comments] })); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <ModalSheet title="Your comments" onClose={onClose} busy={busy}><div className="space-y-4">
    <p className="text-sm text-movenotes-muted">You can remove your own comments even after you lose access to an activity. This list shows only your words.</p>
    <FormError>{error}</FormError>{error && !data && <button className="underline min-h-11" onClick={() => { setError(''); setRetry(n => n + 1); }}>Retry</button>}
    {!data && !error && <p role="status">Loading your comments…</p>}
    {data?.comments.map(c => <article key={c.id} className="rounded-xl border p-3"><p className="text-xs text-movenotes-muted">{new Date(c.created_at).toLocaleDateString()}</p><p className="whitespace-pre-wrap break-words">{c.body}</p><button className="min-h-11 underline text-sm" onClick={() => void remove(c.id)}>Delete comment</button></article>)}
    {data && !data.comments.length && <p>No comments.</p>}
    {data?.has_more && <button className="min-h-11 underline" onClick={() => void older()}>Older comments</button>}
  </div></ModalSheet>;
}
