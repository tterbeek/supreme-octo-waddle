import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import FormPage from "../components/forms/FormPage";
import { FormActions } from "../components/forms/FormLayout";
import { allowFormNavigation } from "../lib/formLifecycle";
import { NOTE_STORAGE_BUCKET, signStorageValues } from "../services/storage.service";
import {
  CIRCLE_ACCESS_UPDATED_EVENT,
  acceptCircleInvite,
  getCircleInvitePreview,
  type CircleInvitePreview,
} from "../services/circle.service";

export default function CircleInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [preview, setPreview] = useState<CircleInvitePreview | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const uid = user?.id || null;
        if (!uid) {
          const next = `${location.pathname}${location.search}`;
          navigate(`/login?next=${encodeURIComponent(next)}`, { replace: true });
          return;
        }

        const invite = token ? await getCircleInvitePreview(token) : null;
        setUserId(uid);
        setPreview(invite);

        const avatarPath = invite?.profile_thumb_path || invite?.profile_image_path;
        if (avatarPath) {
          const map = await signStorageValues([avatarPath], {
            primaryBucket: NOTE_STORAGE_BUCKET,
          });
          setAvatarUrl(map[avatarPath] || null);
        } else {
          setAvatarUrl(null);
        }
      } catch (err: any) {
        setMessage(err?.message || "Could not open invite.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [location.pathname, location.search, navigate, token]);

  const statusText = useMemo(() => {
    if (!preview) return "Invite not found.";
    if (preview.invite_status === "invalid") return "This invite link is invalid.";
    if (preview.invite_status === "expired") return "This invite link has expired.";
    if (preview.invite_status === "revoked") return "This invite link was revoked.";
    if (preview.invite_status === "used") return "This invite link has already been used.";
    return null;
  }, [preview]);

  const handleAccept = async () => {
    if (!token || !userId) return;
    setAccepting(true);
    setMessage(null);
    try {
      const result = await acceptCircleInvite(token, userId);
      if (result === "connected" || result === "already_connected") {
        window.dispatchEvent(new Event(CIRCLE_ACCESS_UPDATED_EVENT));
        allowFormNavigation(() => navigate("/settings/circle", { replace: true }));
        return;
      } else if (result === "cannot_accept_own") {
        setMessage("You cannot accept your own invite.");
      } else if (result === "blocked") {
        setMessage("This connection is currently blocked.");
      } else if (result === "used") {
        setMessage("This invite link has already been used.");
      } else if (result === "expired") {
        setMessage("This invite link has expired.");
      } else if (result === "revoked") {
        setMessage("This invite link was revoked.");
      } else {
        setMessage("Could not accept invite.");
      }
    } catch (err: any) {
      setMessage(err?.message || "Could not accept invite.");
    } finally {
      setAccepting(false);
    }
  };

  return (
    <FormPage title="Social circle invitation" backTo="/settings/circle" busy={accepting}>

        {loading ? (
          <p className="text-sm text-gray-500">Loading invitation…</p>
        ) : statusText ? (
          <p className="text-sm text-gray-600">{statusText}</p>
        ) : preview ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={preview.friendly_name || "Profile"}
                  className="h-14 w-14 rounded-full object-cover border border-warm-300"
                />
              ) : (
                <div className="h-14 w-14 rounded-full bg-warm-300 border border-warm-300 flex items-center justify-center text-lg font-semibold text-gray-700">
                  {(preview.friendly_name || "M").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-base font-semibold text-gray-900">
                  {preview.friendly_name || "Mover"}
                </p>
                <p className="text-xs text-gray-500">{preview.account_email || "No email"}</p>
              </div>
            </div>

            <p className="text-sm text-gray-700">
              Do you want to connect with this user in your social circle?
            </p>

            {message && (
              <p className="text-sm text-gray-700 rounded-lg border border-warm-200 bg-warm-100 px-3 py-2">
                {message}
              </p>
            )}

            <div className="flex items-center gap-2">
              <FormActions><button
                type="button"
                onClick={handleAccept}
                disabled={accepting || !userId}
                className="px-3 py-2 rounded-full bg-movenotes-primary text-primary-text text-sm font-medium disabled:opacity-60"
              >
                {accepting ? "Accepting..." : "Accept invitation"}
              </button></FormActions>
              <button
                type="button"
                onClick={() => navigate("/settings/circle")}
                className="px-3 py-2 rounded-full border border-warm-300 text-sm text-gray-700"
              >
                Go to social circle
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600">Invite not found.</p>
        )}
    </FormPage>
  );
}
