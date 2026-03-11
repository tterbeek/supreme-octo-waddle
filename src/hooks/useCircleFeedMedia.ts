import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import type { CircleFeedItem } from "../services/circle.service";
import {
  LEGACY_NOTE_STORAGE_BUCKET,
  NOTE_STORAGE_BUCKET,
  signStorageValues,
} from "../services/storage.service";
import { getPreferredCoverPath } from "../lib/circleFeed";

export function useCircleFeedMedia(rows: CircleFeedItem[]) {
  const [signedCoverByRecipient, setSignedCoverByRecipient] = useState<Record<string, string>>(
    {}
  );
  const [signedAvatars, setSignedAvatars] = useState<Record<string, string>>({});
  const [coverOrientationByRecipient, setCoverOrientationByRecipient] = useState<
    Record<string, "portrait" | "landscape">
  >({});
  const requestIdRef = useRef(0);

  const signAssets = useCallback(async (feedRows: CircleFeedItem[]) => {
    const coverPathByRecipient: Record<string, string> = {};
    for (const row of feedRows) {
      const coverPath = getPreferredCoverPath(row);
      if (coverPath) {
        coverPathByRecipient[row.recipient_id] = coverPath;
      }
    }

    const missingShareIds = Array.from(
      new Set(
        feedRows
          .filter((row) => !coverPathByRecipient[row.recipient_id])
          .map((row) => row.activity_share_id)
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      )
    );

    if (missingShareIds.length) {
      const { data, error } = await supabase
        .from("activity_share_photos")
        .select("activity_share_id, image_path, thumb_path, sort_order, created_at, id")
        .in("activity_share_id", missingShareIds)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .order("id", { ascending: true });

      if (error) {
        console.warn("[Circle] Could not load activity_share_photos fallback:", error.message);
      }

      const allByShare: Record<string, string[]> = {};
      for (const photo of data || []) {
        const list = (allByShare[photo.activity_share_id] ||= []);
        if (photo.thumb_path) list.push(photo.thumb_path);
        if (photo.image_path) list.push(photo.image_path);
      }

      for (const row of feedRows) {
        if (!coverPathByRecipient[row.recipient_id]) {
          const fallback = allByShare[row.activity_share_id];
          if (fallback?.length) coverPathByRecipient[row.recipient_id] = fallback[0];
        }
      }
    }

    const photoRaw = Array.from(new Set(Object.values(coverPathByRecipient)));
    const avatarRaw = Array.from(
      new Set(
        feedRows
          .map((row) => row.author_profile_thumb_path || row.author_profile_image_path)
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      )
    );

    const photoSignedByRaw = await signStorageValues(photoRaw, {
      primaryBucket: NOTE_STORAGE_BUCKET,
      fallbackBuckets: [LEGACY_NOTE_STORAGE_BUCKET],
    });
    const signedByRecipient: Record<string, string> = {};
    for (const [recipientId, rawPath] of Object.entries(coverPathByRecipient)) {
      const signed = photoSignedByRaw[rawPath];
      if (signed) {
        signedByRecipient[recipientId] = signed;
      }
    }
    const avatarSignedByRaw = await signStorageValues(avatarRaw, {
      primaryBucket: NOTE_STORAGE_BUCKET,
      fallbackBuckets: [LEGACY_NOTE_STORAGE_BUCKET],
    });

    return {
      signedByRecipient,
      avatarSignedByRaw,
    };
  }, []);

  useEffect(() => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    (async () => {
      const result = await signAssets(rows);
      if (!result) return;
      if (requestIdRef.current !== requestId) return;
      setSignedCoverByRecipient(result.signedByRecipient);
      setSignedAvatars(result.avatarSignedByRaw);
    })();
  }, [rows, signAssets]);

  const onCoverLoad = useCallback(
    (recipientId: string, naturalWidth: number, naturalHeight: number) => {
      setCoverOrientationByRecipient((prev) => ({
        ...prev,
        [recipientId]: naturalHeight > naturalWidth ? "portrait" : "landscape",
      }));
    },
    []
  );

  return {
    signedCoverByRecipient,
    signedAvatars,
    coverOrientationByRecipient,
    onCoverLoad,
  };
}
