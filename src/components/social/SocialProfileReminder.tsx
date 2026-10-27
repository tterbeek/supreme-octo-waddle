import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CIRCLE_ACCESS_UPDATED_EVENT, fetchCircleConnectionState, fetchOwnCircleProfile } from '../../services/circle.service';

export default function SocialProfileReminder({ userId, hasCommunity }: { userId: string; hasCommunity: boolean }) {
  const [reminder, setReminder] = useState<{ userId: string; needsPhoto: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let revision = 0;
    setReminder(null);
    const load = async () => {
      const current = ++revision;
      try {
        const profile = await fetchOwnCircleProfile(userId);
        const name = profile?.social_display_name?.trim();
        const missingName = !name || name.toLowerCase() === 'movenotes member';
        const connected = missingName && (hasCommunity || (await fetchCircleConnectionState(userId)).acceptedCount > 0);
        if (!cancelled && current === revision) {
          setReminder(connected ? { userId, needsPhoto: !profile?.social_profile_image_path && !profile?.social_profile_thumb_path } : null);
        }
      } catch {
        // A profile lookup must never interrupt reading the feed.
        if (!cancelled && current === revision) setReminder(null);
      }
    };
    if (userId) void load();
    const refresh = () => { if (userId) void load(); };
    window.addEventListener('focus', refresh);
    window.addEventListener(CIRCLE_ACCESS_UPDATED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', refresh);
      window.removeEventListener(CIRCLE_ACCESS_UPDATED_EVENT, refresh);
    };
  }, [userId, hasCommunity]);

  if (!reminder || reminder.userId !== userId) return null;
  return <aside aria-label="Complete your Circle profile" className="rounded-xl border border-warm-200 bg-warm-100 px-4 py-3 text-sm">
    <p>Add your name{reminder.needsPhoto ? ' and a profile picture' : ''} so people in your Circle and Communities can recognize you.</p>
    <Link to="/settings/profile" className="inline-block min-h-11 py-3 underline underline-offset-2">Update your profile</Link>
  </aside>;
}
