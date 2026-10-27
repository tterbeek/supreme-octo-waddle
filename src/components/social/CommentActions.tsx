import { useId, useState } from 'react';
import { IconFlag, IconTrash } from '@tabler/icons-react';
import DialogSheet from '../DialogSheet';
import FormTextarea from '../forms/FormTextarea';
import { FormActions, FormError } from '../forms/FormLayout';
import { socialConversation, type Conversation, type SocialComment } from '../../services/social.service';

export default function CommentActions({ activityId, comment, onClose, onUpdated }: {
  activityId: string;
  comment: SocialComment;
  onClose: () => void;
  onUpdated: (value: Conversation) => void;
}) {
  const id = useId();
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const act = async (action: 'report' | 'delete_comment') => {
    setBusy(true); setError('');
    try {
      const value = await socialConversation(activityId, action, action === 'report' ? { comment: comment.id, reason } : { id: comment.id });
      onUpdated(value); onClose();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <DialogSheet title={reporting ? 'Report comment' : 'Comment actions'} onClose={onClose} busy={busy} dirty={reporting && !!reason.trim()}>
    <div className="space-y-4">
      <div><p className="text-sm font-semibold">{comment.author}</p><p className="whitespace-pre-wrap break-words text-sm text-movenotes-muted">{comment.body}</p></div>
      <FormError>{error}</FormError>
      {reporting ? <>
        <div className="mn-field"><label htmlFor={id}>What should be reviewed?</label><FormTextarea id={id} maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></div>
        <p className="text-xs text-movenotes-muted">Reports are visible to the activity owner.</p>
        <FormActions><button disabled={busy || !reason.trim()} onClick={() => void act('report')}>Send report</button></FormActions>
      </> : <div className="space-y-1">
        <button type="button" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm hover:bg-white/50" onClick={() => setReporting(true)}><IconFlag size={18} />Report comment</button>
        {comment.can_delete && <button type="button" className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-sm hover:bg-white/50" onClick={() => void act('delete_comment')}><IconTrash size={18} />Delete comment</button>}
      </div>}
    </div>
  </DialogSheet>;
}
