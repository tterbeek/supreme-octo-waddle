import { ACTIVITY_TYPES } from "../config/activityTypes";
import { resolveActivityFields, type ActivityPreference } from "./resolveActivityFields";
import { formatDistance, formatDurationMinutes, type UnitSystem } from "./units";

/** Deliberate allowlist. No IDs, notes, feelings, routes, URLs or account data. */
export type ActivityImageModel = {
  type: string;
  title: string;
  date: string;
  metrics: string[];
};

type ExportableActivity = {
  type: string;
  title?: string | null;
  date: string;
  distance_km?: number | null;
  duration_min?: number | null;
};

export function buildActivityImageModel(activity: ExportableActivity, units: UnitSystem, preference?: ActivityPreference): ActivityImageModel {
  const type = ACTIVITY_TYPES[activity.type] ? activity.type : "other";
  const fields = resolveActivityFields(type, preference);
  const metrics = [...new Set([...fields.defaultFields, ...fields.optionalFields])].flatMap(field => {
    const value = activity[field];
    if (value == null || !Number.isFinite(Number(value)) || Number(value) <= 0) return [];
    return [field === "distance_km" ? formatDistance(Number(value), units) : formatDurationMinutes(Number(value))];
  });
  // Activity dates are calendar days, not UTC instants (same rule as the editor).
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(activity.date);
  if (!match) throw new Error("This activity has no valid date.");
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1 || date.getDate() !== Number(match[3])) throw new Error("This activity has no valid date.");
  return {
    type,
    title: activity.title?.trim() || ACTIVITY_TYPES[type].label,
    date: date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    metrics,
  };
}

/** Each effect gets a ticket. Stale preparations must never replace the current PNG. */
export function createPreparationGate() {
  let revision = 0;
  return { next: () => ++revision, isCurrent: (ticket: number) => ticket === revision, cancel: () => { revision++; } };
}

export type FileShareNavigator = Pick<Navigator, "canShare" | "share">;
export function canShareActivityImage(file: File, nav: FileShareNavigator = navigator, secure = window.isSecureContext): boolean {
  try { return secure && typeof nav.share === "function" && typeof nav.canShare === "function" && nav.canShare({ files: [file] }); }
  catch { return false; }
}

export async function shareActivityImage(file: File, nav: FileShareNavigator = navigator, secure = window.isSecureContext): Promise<"shared" | "cancelled" | "unsupported" | "failed"> {
  if (!canShareActivityImage(file, nav, secure)) return "unsupported";
  try { await nav.share({ files: [file] }); return "shared"; }
  catch (error) { return error instanceof Error && error.name === "AbortError" ? "cancelled" : "failed"; }
}

export function saveActivityImage(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = "movenotes-activity.png";
  // Safari may open a preview instead of downloading; retain the URL until close.
  link.target = "_blank";
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
}
