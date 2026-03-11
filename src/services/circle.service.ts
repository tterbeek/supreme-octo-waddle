import { supabase } from "../supabaseClient";
import type { CircleReactionType } from "../lib/circleReactions";
import {
  compressImage,
  createThumbnail,
  deleteActivityImages,
  uploadActivityImage,
} from "./activityMedia.service";

export const CIRCLE_ACCESS_UPDATED_EVENT = "movenotes:circle-access-updated";
export const CIRCLE_REACTIONS_UPDATED_EVENT =
  "movenotes:circle-reactions-updated";

export type CircleFeedItem = {
  recipient_id: string;
  activity_share_id: string;
  shared_at: string;
  occurred_on: string;
  author_user_id: string;
  author_display_name: string | null;
  author_profile_image_path: string | null;
  author_profile_thumb_path: string | null;
  title: string | null;
  activity_type: string;
  distance_km: number | null;
  duration_min: number | null;
  shared_photo_url: string | null;
  shared_thumb_photo_url: string | null;
  photos:
    | Array<{
        image_path: string | null;
        thumb_path: string | null;
        sort_order: number | null;
      }>
    | string
    | null;
  reaction_groups: unknown;
  current_user_reaction: CircleReactionType | null;
  has_new_reactions: boolean;
  seen_at: string | null;
};

export type CircleConnectionStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "removed"
  | "blocked";

export type CircleConnection = {
  id: string;
  requester_user_id: string;
  addressee_user_id: string;
  status: CircleConnectionStatus;
  created_at: string;
  responded_at: string | null;
};

export type CircleConnectedFriendLabel = {
  friend_user_id: string;
  label: string | null;
  profile_image_path: string | null;
  profile_thumb_path: string | null;
};

export type CircleInvitePreview = {
  invite_status: "active" | "invalid" | "expired" | "revoked" | "used";
  inviter_user_id: string | null;
  friendly_name: string | null;
  account_email: string | null;
  profile_image_path: string | null;
  profile_thumb_path: string | null;
};

export type OwnCircleProfile = {
  user_id: string;
  social_display_name: string | null;
  social_profile_image_path: string | null;
  social_profile_thumb_path: string | null;
  login_email: string | null;
};

export async function hasCircleAccess(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_circle_access", {
    p_user_id: userId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function getCircleFeed(params: {
  userId: string;
  limit?: number;
  beforeOccurredOn?: string | null;
  beforeSharedAt?: string | null;
  beforeRecipientId?: string | null;
}) {
  const {
    userId,
    limit = 30,
    beforeOccurredOn = null,
    beforeSharedAt = null,
    beforeRecipientId = null,
  } = params;
  const { data, error } = await supabase.rpc("get_circle_feed", {
    p_user_id: userId,
    p_limit: limit,
    p_before_occurred_on: beforeOccurredOn,
    p_before_shared_at: beforeSharedAt,
    p_before_recipient_id: beforeRecipientId,
  });
  if (error) throw error;
  return (data || []) as CircleFeedItem[];
}

export async function shareActivityWithConnections(activityId: string, userId: string) {
  const { data, error } = await supabase.rpc("share_activity_with_connections", {
    p_activity_id: activityId,
    p_user_id: userId,
  });
  if (error) throw error;
  return data as string;
}

export async function fetchOwnSharedActivityIds(userId: string, activityIds: string[]) {
  const uniqueIds = Array.from(new Set(activityIds.filter(Boolean)));
  if (uniqueIds.length === 0) return new Set<string>();

  const { data, error } = await supabase
    .from("activity_shares")
    .select("activity_id")
    .eq("author_user_id", userId)
    .is("deleted_at", null)
    .in("activity_id", uniqueIds);

  if (error) throw error;
  return new Set((data || []).map((row) => String(row.activity_id)));
}

export async function unshareActivity(activityId: string, userId: string) {
  const { data, error } = await supabase.rpc("unshare_activity", {
    p_activity_id: activityId,
    p_user_id: userId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function markCircleFeedItemSeen(recipientId: string, userId: string) {
  const { data, error } = await supabase.rpc("mark_circle_feed_item_seen", {
    p_recipient_id: recipientId,
    p_user_id: userId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function hideCircleFeedItem(recipientId: string, userId: string) {
  const { data, error } = await supabase.rpc("hide_circle_feed_item", {
    p_recipient_id: recipientId,
    p_user_id: userId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function upsertCircleActivityReaction(params: {
  activityShareId: string;
  userId: string;
  reactionType: CircleReactionType;
}) {
  const { activityShareId, userId, reactionType } = params;
  const { data, error } = await supabase.rpc("upsert_circle_activity_reaction", {
    p_activity_share_id: activityShareId,
    p_user_id: userId,
    p_reaction_type: reactionType,
  });
  if (error) throw error;
  return (data as string) || null;
}

export async function removeCircleActivityReaction(params: {
  activityShareId: string;
  userId: string;
}) {
  const { activityShareId, userId } = params;
  const { data, error } = await supabase.rpc("remove_circle_activity_reaction", {
    p_activity_share_id: activityShareId,
    p_user_id: userId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function hasCircleNewReactions(userId: string) {
  const { data, error } = await supabase.rpc("has_circle_new_reactions", {
    p_user_id: userId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function markCircleFeedVisited(userId: string) {
  const { data, error } = await supabase.rpc("mark_circle_feed_visited", {
    p_user_id: userId,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function fetchCircleConnectionState(userId: string) {
  const { data, error } = await supabase
    .from("user_connections")
    .select("status, requester_user_id, addressee_user_id")
    .or(`requester_user_id.eq.${userId},addressee_user_id.eq.${userId}`)
    .in("status", ["pending", "accepted"]);

  if (error) throw error;

  let acceptedCount = 0;
  let pendingCount = 0;

  for (const row of data || []) {
    if (row.status === "accepted") acceptedCount += 1;
    if (row.status === "pending") pendingCount += 1;
  }

  return { acceptedCount, pendingCount };
}

export async function fetchOwnCircleProfile(userId: string) {
  const { data, error } = await supabase
    .from("user_preferences")
    .select(
      "user_id, social_display_name, social_profile_image_path, social_profile_thumb_path, login_email"
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data || null) as OwnCircleProfile | null;
}

export async function saveOwnCircleProfile(params: {
  userId: string;
  socialDisplayName: string | null;
  socialProfileImagePath: string | null;
  socialProfileThumbPath: string | null;
}) {
  const { userId, socialDisplayName, socialProfileImagePath, socialProfileThumbPath } =
    params;
  const { error } = await supabase.from("user_preferences").upsert({
    user_id: userId,
    social_display_name: socialDisplayName,
    social_profile_image_path: socialProfileImagePath,
    social_profile_thumb_path: socialProfileThumbPath,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return true;
}

export async function uploadCircleProfileImage(params: {
  userId: string;
  file: File;
  previousImagePath?: string | null;
  previousThumbPath?: string | null;
}) {
  const { userId, file, previousImagePath, previousThumbPath } = params;
  const compressed = await compressImage(file);
  const thumb = await createThumbnail(file);
  const { imagePath, thumbPath } = await uploadActivityImage(
    userId,
    "circle-profile",
    compressed,
    thumb
  );

  const oldPaths = [previousImagePath, previousThumbPath].filter(
    (path): path is string =>
      Boolean(path) && path !== imagePath && path !== thumbPath
  );
  if (oldPaths.length) {
    await deleteActivityImages(oldPaths);
  }

  return { imagePath, thumbPath };
}

export async function fetchCircleConnections(userId: string) {
  const { data, error } = await supabase
    .from("user_connections")
    .select(
      "id, requester_user_id, addressee_user_id, status, created_at, responded_at"
    )
    .or(`requester_user_id.eq.${userId},addressee_user_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as CircleConnection[];
}

export async function fetchCircleConnectedFriendLabels(userId: string) {
  const { data, error } = await supabase.rpc("get_circle_connected_friends", {
    p_user_id: userId,
  });
  if (error) throw error;
  return (data || []) as CircleConnectedFriendLabel[];
}

export async function createCircleInviteLink(userId: string) {
  const { data, error } = await supabase.rpc("create_circle_invite_link", {
    p_user_id: userId,
  });
  if (error) throw error;
  const token = String(data || "");
  if (!token) {
    throw new Error("Could not create invite link.");
  }
  return token;
}

export async function getCircleInvitePreview(token: string) {
  const { data, error } = await supabase.rpc("get_circle_invite_preview", {
    p_token: token,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return {
      invite_status: "invalid",
      inviter_user_id: null,
      friendly_name: null,
      account_email: null,
      profile_image_path: null,
      profile_thumb_path: null,
    } satisfies CircleInvitePreview;
  }

  return row as CircleInvitePreview;
}

export async function acceptCircleInvite(token: string, userId: string) {
  const { data, error } = await supabase.rpc("accept_circle_invite", {
    p_token: token,
    p_user_id: userId,
  });
  if (error) throw error;
  return String(data || "");
}

export async function respondToCircleConnection(params: {
  connectionId: string;
  userId: string;
  nextStatus: "accepted" | "declined" | "removed" | "blocked";
}) {
  const { connectionId, userId, nextStatus } = params;
  const now = new Date().toISOString();

  const query = supabase
    .from("user_connections")
    .update({
      status: nextStatus,
      responded_at: now,
    })
    .eq("id", connectionId);

  if (nextStatus === "removed") {
    const { error } = await query.or(
      `requester_user_id.eq.${userId},addressee_user_id.eq.${userId}`
    );
    if (error) throw error;
    return true;
  }

  const { error } = await query.eq("addressee_user_id", userId);
  if (error) throw error;
  return true;
}
