import { useCallback, useEffect, useMemo, useState } from "react";
import { IconShare } from "@tabler/icons-react";
import Toast from "../components/Toast";
import { NOTE_STORAGE_BUCKET, signStorageValues } from "../services/storage.service";
import { getCurrentUser } from "../services/auth.service";
import {
  createCircleInviteLink,
  CIRCLE_ACCESS_UPDATED_EVENT,
  fetchCircleConnectedFriendLabels,
  fetchCircleConnections,
  fetchOwnCircleProfile,
  respondToCircleConnection,
  saveOwnCircleProfile,
  type CircleConnection,
  uploadCircleProfileImage,
} from "../services/circle.service";

const shortUserId = (value: string) => value.slice(0, 8);
export default function ManageCirclePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [creatingInviteLink, setCreatingInviteLink] = useState(false);
  const [inviteToast, setInviteToast] = useState<string | null>(null);
  const [socialDisplayName, setSocialDisplayName] = useState("");
  const [profileImagePath, setProfileImagePath] = useState<string | null>(null);
  const [profileThumbPath, setProfileThumbPath] = useState<string | null>(null);
  const [profilePreviewUrl, setProfilePreviewUrl] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState<string | null>(null);
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
        const [profile] = await Promise.all([fetchOwnCircleProfile(user.id)]);
        await loadConnections(user.id);
        if (profile) {
          setSocialDisplayName(profile.social_display_name || "");
          setProfileImagePath(profile.social_profile_image_path || null);
          setProfileThumbPath(profile.social_profile_thumb_path || null);
          setLoginEmail(profile.login_email || user.email || null);
        } else {
          setLoginEmail(user.email || null);
        }
      } catch (err: any) {
        setError(err?.message || "Could not load Circle connections.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [loadConnections]);

  useEffect(() => {
    const loadProfilePreview = async () => {
      const path = profileThumbPath || profileImagePath;
      if (!path) {
        setProfilePreviewUrl(null);
        return;
      }
      const map = await signStorageValues([path], {
        primaryBucket: NOTE_STORAGE_BUCKET,
      });
      setProfilePreviewUrl(map[path] || null);
    };
    void loadProfilePreview();
  }, [profileImagePath, profileThumbPath]);

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

  const handleSaveProfile = async () => {
    if (!userId) return;
    setSavingProfile(true);
    setError(null);
    setNotice(null);
    try {
      await saveOwnCircleProfile({
        userId,
        socialDisplayName: socialDisplayName.trim() || null,
        socialProfileImagePath: profileImagePath,
        socialProfileThumbPath: profileThumbPath,
      });
      setNotice("Mini profile saved.");
    } catch (err: any) {
      setError(err?.message || "Could not save mini profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAvatarSelected = async (file: File | null) => {
    if (!userId || !file) return;
    setUploadingAvatar(true);
    setSavingProfile(true);
    setError(null);
    setNotice(null);
    try {
      const uploaded = await uploadCircleProfileImage({
        userId,
        file,
        previousImagePath: profileImagePath,
        previousThumbPath: profileThumbPath,
      });
      setProfileImagePath(uploaded.imagePath);
      setProfileThumbPath(uploaded.thumbPath || null);
      await saveOwnCircleProfile({
        userId,
        socialDisplayName: socialDisplayName.trim() || null,
        socialProfileImagePath: uploaded.imagePath,
        socialProfileThumbPath: uploaded.thumbPath || null,
      });
      setNotice("Profile picture saved.");
    } catch (err: any) {
      setError(err?.message || "Could not upload profile picture.");
    } finally {
      setUploadingAvatar(false);
      setSavingProfile(false);
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
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-6 text-gray-800">Manage social circle</h1>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {notice && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {notice}
        </div>
      )}

      <section className="w-full bg-warm-100 border border-warm-200 px-4 py-3 rounded-xl mb-4">
        <h2 className="text-sm font-medium text-gray-800 mb-2">Profile</h2>
        <p className="text-xs text-gray-500 mb-3">
          Set your friendly name and profile picture for Circle.
        </p>

        <div className="flex items-center gap-3 mb-3">
          {profilePreviewUrl ? (
            <img
              src={profilePreviewUrl}
              alt="Your profile"
              className="h-14 w-14 rounded-full object-cover border border-warm-300"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-warm-300 text-gray-700 border border-warm-300 flex items-center justify-center text-lg font-semibold">
              {(socialDisplayName || loginEmail || "M").slice(0, 1).toUpperCase()}
            </div>
          )}

          <label className="px-3 py-2 rounded-full border border-warm-300 text-sm text-gray-700 cursor-pointer">
            {uploadingAvatar ? "Uploading..." : "Upload picture"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                void handleAvatarSelected(file);
                e.currentTarget.value = "";
              }}
              disabled={uploadingAvatar}
            />
          </label>
        </div>

        <label className="text-xs text-gray-600">Friendly name</label>
        <input
          type="text"
          value={socialDisplayName}
          onChange={(e) => setSocialDisplayName(e.target.value)}
          placeholder="How others should see you"
          className="mt-1 w-full rounded-lg border border-warm-300 bg-white px-3 py-2 text-sm"
        />
        <p className="text-xs text-gray-500 mt-2">
          Account email: {loginEmail || "Unavailable"}
        </p>
        <button
          type="button"
          onClick={handleSaveProfile}
          disabled={savingProfile}
          className="mt-2 px-3 py-2 rounded-full bg-movenotes-primary text-primary-text text-sm font-medium disabled:opacity-60"
        >
          {savingProfile ? "Saving..." : "Save profile"}
        </button>
      </section>

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
    </div>
  );
}
