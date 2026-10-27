import { useEffect, useRef, useState } from 'react';
import FormPage from '../components/forms/FormPage';
import { FormActions, FormError } from '../components/forms/FormLayout';
import { getCurrentUser } from '../services/auth.service';
import { fetchOwnCircleProfile, saveOwnCircleProfile, uploadCircleProfileImage, CIRCLE_ACCESS_UPDATED_EVENT } from '../services/circle.service';
import { NOTE_STORAGE_BUCKET, signStorageValues } from '../services/storage.service';

export default function ProfileSettingsPage() {
  const input = useRef<HTMLInputElement>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [name, setName] = useState('');
  const [savedName, setSavedName] = useState('');
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [thumbPath, setThumbPath] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [email, setEmail] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const user = await getCurrentUser();
        if (!user) throw new Error('Sign in to update your profile.');
        const profile = await fetchOwnCircleProfile(user.id);
        if (cancelled) return;
        setUserId(user.id); setName(profile?.social_display_name || ''); setSavedName(profile?.social_display_name || '');
        setImagePath(profile?.social_profile_image_path || null); setThumbPath(profile?.social_profile_thumb_path || null);
        setEmail(profile?.login_email || user.email || '');
      } catch (e) { if (!cancelled) setError((e as Error).message); }
      finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const path = thumbPath || imagePath;
    if (!path) { setPreview(null); return; }
    void signStorageValues([path], { primaryBucket: NOTE_STORAGE_BUCKET }).then(map => { if (!cancelled) setPreview(map[path] || null); }).catch(() => { if (!cancelled) setPreview(null); });
    return () => { cancelled = true; };
  }, [imagePath, thumbPath]);

  const save = async (file?: File) => {
    if (!userId) return;
    setBusy(true); setUploading(!!file); setError(''); setNotice('');
    try {
      const uploaded = file ? await uploadCircleProfileImage({ userId, file, previousImagePath: imagePath, previousThumbPath: thumbPath }) : null;
      const image = uploaded?.imagePath || imagePath;
      const thumb = uploaded ? uploaded.thumbPath || null : thumbPath;
      await saveOwnCircleProfile({ userId, socialDisplayName: name.trim() || null, socialProfileImagePath: image, socialProfileThumbPath: thumb });
      setImagePath(image); setThumbPath(thumb); setName(name.trim()); setSavedName(name.trim());
      setNotice(file ? 'Profile picture saved.' : 'Profile saved.');
      window.dispatchEvent(new Event(CIRCLE_ACCESS_UPDATED_EVENT));
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); setUploading(false); }
  };

  return <FormPage title="Profile" ready={!loading} dirty={name !== savedName} busy={busy}>
    {loading && <p role="status">Loading profile…</p>}
    <FormError>{error}</FormError>
    {notice && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{notice}</p>}
    <p className="text-sm text-movenotes-muted">Set your friendly name and profile picture for Circle and Communities.</p>
    <div className="flex flex-wrap items-center gap-3">
      {preview ? <img src={preview} alt="Your profile" className="h-14 w-14 rounded-full border border-warm-300 object-cover" /> : <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full border border-warm-300 bg-warm-300 text-lg font-semibold text-gray-700">{(name || email || 'M').slice(0, 1).toUpperCase()}</span>}
      <button type="button" disabled={busy || !userId} className="min-h-11 rounded-full border border-warm-300 px-4 text-sm" onClick={() => input.current?.click()}>{uploading ? 'Uploading…' : 'Upload picture'}</button>
      <input ref={input} aria-label="Profile picture" type="file" accept="image/*" className="hidden" disabled={busy || !userId} onChange={event => { const file = event.target.files?.[0]; if (file) void save(file); event.target.value = ''; }} />
    </div>
    <div className="mn-field"><label htmlFor="circle-name">Friendly name</label><input id="circle-name" type="text" value={name} onChange={event => setName(event.target.value)} placeholder="How others should see you" /></div>
    <p className="text-xs text-movenotes-muted">Account email: {email || 'Unavailable'}</p>
    <FormActions><button disabled={busy || loading || !userId} onClick={() => void save()}>{busy ? 'Saving…' : 'Save profile'}</button></FormActions>
  </FormPage>;
}
