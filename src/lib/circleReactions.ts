import type { ComponentType } from "react";
import {
  IconHeart,
  IconPhotoSpark,
  IconSeedling,
  IconSunHigh,
  IconWalk,
} from "@tabler/icons-react";

export const CIRCLE_REACTION_OPTIONS = [
  { type: "CHEER", label: "Cheering you on", Icon: IconHeart },
  { type: "INSPIRED", label: "Inspired", Icon: IconSeedling },
  { type: "ENERGY", label: "Good energy", Icon: IconSunHigh },
  { type: "BEAUTIFUL", label: "Beautiful moment", Icon: IconPhotoSpark },
  { type: "MOVED", label: "Inspired me to move", Icon: IconWalk },
] as const;

export type CircleReactionType = (typeof CIRCLE_REACTION_OPTIONS)[number]["type"];
export type CircleReactionIcon = ComponentType<{
  size?: number;
  strokeWidth?: number;
}>;

export type CircleReactionActor = {
  user_id: string;
  name: string;
  profile_thumb_path: string | null;
  reacted_at: string | null;
};

export type CircleReactionGroups = Record<CircleReactionType, CircleReactionActor[]>;

const EMPTY_REACTION_GROUPS: CircleReactionGroups = {
  CHEER: [],
  INSPIRED: [],
  ENERGY: [],
  BEAUTIFUL: [],
  MOVED: [],
};

export function isCircleReactionType(value: string): value is CircleReactionType {
  return CIRCLE_REACTION_OPTIONS.some((option) => option.type === value);
}

export function parseCircleReactionType(value: unknown): CircleReactionType | null {
  if (typeof value !== "string") return null;
  return isCircleReactionType(value) ? value : null;
}

export function parseCircleReactionGroups(value: unknown): CircleReactionGroups {
  let source: unknown = value;

  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return { ...EMPTY_REACTION_GROUPS };
    }
  }

  if (!source || typeof source !== "object") {
    return { ...EMPTY_REACTION_GROUPS };
  }

  const record = source as Record<string, unknown>;
  const parsed: CircleReactionGroups = { ...EMPTY_REACTION_GROUPS };

  for (const option of CIRCLE_REACTION_OPTIONS) {
    const rawList = record[option.type];
    if (!Array.isArray(rawList)) continue;

    parsed[option.type] = rawList.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Record<string, unknown>;
      const userId = typeof item.user_id === "string" ? item.user_id : "";
      if (!userId) return [];

      const nameRaw = typeof item.name === "string" ? item.name.trim() : "";
      const profileThumbPath =
        typeof item.profile_thumb_path === "string" && item.profile_thumb_path.length > 0
          ? item.profile_thumb_path
          : null;
      const reactedAt =
        typeof item.reacted_at === "string" && item.reacted_at.length > 0
          ? item.reacted_at
          : null;

      return [
        {
          user_id: userId,
          name: nameRaw || "Mover",
          profile_thumb_path: profileThumbPath,
          reacted_at: reactedAt,
        },
      ];
    });
  }

  return parsed;
}
