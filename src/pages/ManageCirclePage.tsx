import { useCallback, useEffect, useMemo, useState } from "react";
import { IconShare } from "@tabler/icons-react";
import { Link } from 'react-router-dom';
import { SOCIAL_V2_ENABLED,CIRCLE_FILTER } from '../config/social';
import Toast from "../components/Toast";
import FormPage from "../components/forms/FormPage";
import { NOTE_STORAGE_BUCKET, signStorageValues } from "../services/storage.service";
import { getCurrentUser } from "../services/auth.service";
import {
  createCircleInviteLink,
  CIRCLE_ACCESS_UPDATED_EVENT,
  fetchCircleConnectedFriendLabels,
  fetchCircleConnections,
  respondToCircleConnection,
  type CircleConnection,
} from "../services/circle.service";

const shortUserId = (value: string) => value.slice(0, 8);
export default function ManageCirclePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [creatingInviteLink, setCreatingInviteLink] = useState(false);
  const [inviteToast, setInviteToast] = useState<string | null>(null);
  const [rows, setRows] = useState<CircleConnection[]>([]);
  const [otherUserLabels, setOtherUserLabels] = useState<Record<string, string>>({});
  const [otherUserAvatarUrls, setOtherUserAvatarUrls] = useState<Record<string, string>>({});

  const loadOtherUserLabels = useCallback(
    async (uid: string, connections: CircleConnection[]) => {
      const ids = Array.from(
        new Set(
          connections
            .filter((row) => row.status === "accepted")
            .map((row) =>
              row.requester_user_id === uid
                ? row.addressee_user_id
                : row.requester_user_id
            )
        )
      );

      if (ids.length === 0) {
        setOtherUserLabels({});
        setOtherUserAvatarUrls({});
        return;
      }

      const fallback: Record<string, string> = {};
      for (const id of ids) fallback[id] = shortUserId(id);

      try {
        const data = await fetchCircleConnectedFriendLabels(uid);
        const labels = { ...fallback };
        for (const row of data) {
          const label = row.label?.trim();
          if (label) {
            labels[row.friend_user_id] = label;
          }
        }
        setOtherUserLabels(labels);

        const pathByUser: Record<string, string> = {};
        for (const row of data) {
          const path = row.profile_thumb_path || row.profile_image_path;
          if (path) pathByUser[row.friend_user_id] = path;
        }

        const paths = Array.from(new Set(Object.values(pathByUser)));
        if (paths.length === 0) {
          setOtherUserAvatarUrls({});
        } else {
          const signedMap = await signStorageValues(paths, {
            primaryBucket: NOTE_STORAGE_BUCKET,
          });
          const avatarMap: Record<string, string> = {};
          for (const [friendId, path] of Object.entries(pathByUser)) {
            const url = signedMap[path];
            if (url) avatarMap[friendId] = url;
          }
          setOtherUserAvatarUrls(avatarMap);
        }
      } catch {
        setOtherUserLabels(fallback);
        setOtherUserAvatarUrls({});
      }
    },
    []
  );

  const loadConnections = useCallback(
    async (uid: string) => {
      const data = await fetchCircleConnections(uid);
      setRows(data);
      await loadOtherUserLabels(uid, data);
    },
    [loadOtherUserLabels]
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const user = await getCurrentUser();
        if (!user) {
          setLoading(false);
          return;
        }
        setUserId(user.id);
        await loadConnections(user.id);
      } catch (err: any) {
        setError(err?.message || "Could not load Circle connections.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [loadConnections]);

  const accepted = useMemo(
    () => rows.filter((row) => row.status === "accepted"),
    [rows]
  );

  const getOtherUserId = (row: CircleConnection) => {
    if (!userId) return row.requester_user_id;
    return row.requester_user_id === userId
      ? row.addressee_user_id
      : row.requester_user_id;
  };

  const getOtherUserLabel = (row: CircleConnection) => {
    const otherId = getOtherUserId(row);
    return otherUserLabels[otherId] || shortUserId(otherId);
  };

  const getOtherUserAvatarUrl = (row: CircleConnection) => {
    const otherId = getOtherUserId(row);
    return otherUserAvatarUrls[otherId] || null;
  };

  const shareInviteLink = async () => {
    if (!userId) return;
    setCreatingInviteLink(true);
    setError(null);
    setNotice(null);

    try {
      const token = await createCircleInviteLink(userId);
      const link = `${window.location.origin}/circle/invite/${token}`;
      const shareText =
        "Hi, I want to share my movement story with you on MoveNotes please add me to your circle with following link:";
      const payload = `${shareText} ${link}`;

      if (navigator.share) {
        try {
          await navigator.share({
            title: "MoveNotes social circle invite",
            text: shareText,
            url: link,
          });
          return;
        } catch {
          // user cancelled; do nothing
          return;
        }
      }

      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(payload);
      } else {
        const ta = document.createElement("textarea");
        ta.value = payload;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setInviteToast("Invitation copied, share it any way you want");
    } catch (err: any) {
      setError(err?.message || "Could not create and share invite link.");
    } finally {
      setCreatingInviteLink(false);
    }
  };

  const handleRespond = async (
    connectionId: string,
    nextStatus: "accepted" | "declined" | "removed" | "blocked"
  ) => {
    if (!userId) return;
    setMutatingId(connectionId);
    setError(null);
    setNotice(null);
    try {
      await respondToCircleConnection({ connectionId, userId, nextStatus });
      if (nextStatus === "accepted") setNotice("Connection accepted.");
      if (nextStatus === "declined") setNotice("Request declined.");
      if (nextStatus === "removed") setNotice("Connection removed.");
      await loadConnections(userId);
      window.dispatchEvent(new Event(CIRCLE_ACCESS_UPDATED_EVENT));
    } catch (err: any) {
      setError(err?.message || "Could not update connection.");
    } finally {
      setMutatingId(null);
    }
  };

  return (
    <FormPage title="Manage social circle" ready={!loading} busy={creatingInviteLink || Boolean(mutatingId)}>
      {SOCIAL_V2_ENABLED&&<section className="rounded-xl border p-4 space-y-2 text-sm">
        <p>Circle is your accepted personal connections. New connections can see
          still-shared history. Connecting does not publish private activities.</p>
        <Link className="inline-block min-h-11 py-3 underline" to={`/circle?audience=${CIRCLE_FILTER}`}>View Circle and choose your sharing mode</Link>
      </section>}

      {error && (
        <div role="alert" className="mn-error">
          {error}
        </div>
      )}

      {notice && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {notice}
        </div>
      )}

      <section className="w-full bg-warm-100 border border-warm-200 px-4 py-3 rounded-xl mb-4">
        <h2 className="text-sm font-medium text-gray-800 mb-2">Invite by link</h2>
        <p className="text-xs text-gray-500 mb-2">
          Create and share a link in one step.
        </p>
        <button
          type="button"
          onClick={shareInviteLink}
          disabled={creatingInviteLink}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-movenotes-primary text-primary-text text-sm font-medium disabled:opacity-60"
        >
          <IconShare size={16} strokeWidth={1.8} />
          {creatingInviteLink ? "Preparing..." : "Share invite"}
        </button>
      </section>

      <section className="w-full bg-warm-100 border border-warm-200 px-4 py-3 rounded-xl mb-4">
        <h2 className="text-sm font-medium text-gray-800 mb-2">Connected friends</h2>
        {loading ? (
          <p className="text-xs text-gray-500">Loading…</p>
        ) : accepted.length === 0 ? (
          <p className="text-xs text-gray-500">No accepted connections yet.</p>
        ) : (
          <div className="space-y-2">
            {accepted.map((row) => {
              const label = getOtherUserLabel(row);
              const avatarUrl = getOtherUserAvatarUrl(row);
              return (
                <div
                  key={row.id}
                  className="rounded-lg border border-warm-300 p-2 text-sm flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={label}
                        className="h-6 w-6 rounded-full object-cover border border-warm-300"
                      />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-warm-300 border border-warm-300 flex items-center justify-center text-[10px] font-semibold text-gray-700">
                        {label.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span className="text-gray-700 truncate">{label}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRespond(row.id, "removed")}
                    disabled={mutatingId === row.id}
                    className="px-3 py-1.5 rounded-full border border-warm-300 text-xs text-gray-700 disabled:opacity-60"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
      {inviteToast && (
        <Toast
          message={inviteToast}
          durationMs={2000}
          onClose={() => setInviteToast(null)}
        />
      )}
    </FormPage>
  );
}
