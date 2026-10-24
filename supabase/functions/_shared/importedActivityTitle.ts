export type RoutePoint = { lat: number; lng: number };
export type ImportedTitleInput = {
  activityType: string;
  startedAt?: string | null;
  /** IANA zone, UTC offset string, or minutes east of UTC. */
  timezone?: string | number | null;
  providerTitle?: string | null;
  genericTitles?: string[];
  route?: RoutePoint[] | null;
};

const labels: Record<string, string> = {
  run: "run", ride: "ride", walk: "walk", strength: "strength", yoga: "yoga",
  hike: "hike", swim: "swim", meditation: "meditate", restore: "restore", other: "activity",
};
const genericNames: Record<string, string[]> = {
  run: ["run", "running", "trail run", "trail running", "road running", "jogging", "virtual run"],
  ride: ["ride", "cycling", "biking", "bike", "road cycling", "mountain biking", "indoor cycling", "spinning", "virtual ride"],
  walk: ["walk", "walking", "nordic walking"], hike: ["hike", "hiking", "trekking"],
  swim: ["swim", "swimming", "pool swimming", "open water swimming"],
  strength: ["strength", "strength training", "weight training", "weights", "gym", "workout"],
  yoga: ["yoga"], meditation: ["meditation", "meditate", "mindfulness"],
  restore: ["restore", "recovery", "stretching", "mobility"], other: ["other"],
};
const normalize = (text: string) => text.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
export function isGenericImportedTitle(input: ImportedTitleInput) {
  const title = normalize(input.providerTitle ?? "");
  return !title || ["activity", "exercise", "training", "training session", ...(genericNames[input.activityType] ?? []), ...(input.genericTitles ?? [])]
    .some(value => normalize(value) === title);
}

const hasZone = (text: string) => /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text);
export function importedUtcOffset(timezone: ImportedTitleInput["timezone"]): number | null {
  if (typeof timezone === "number") return Number.isInteger(timezone) && Math.abs(timezone) <= 14 * 60 ? timezone : null;
  const match = timezone?.match(/^(?:UTC|GMT)?([+-])(\d{2}):?(\d{2})$/i);
  if (!match || Number(match[3]) > 59) return null;
  const minutes = (Number(match[2]) * 60 + Number(match[3])) * (match[1] === "-" ? -1 : 1);
  return Math.abs(minutes) <= 14 * 60 ? minutes : null;
}

/** Naive provider datetimes are wall-clock local time, never the server's zone. */
export function importedStartInstant(startedAt: string, timezone?: ImportedTitleInput["timezone"]) {
  const offset = importedUtcOffset(timezone);
  const instant = Date.parse(hasZone(startedAt) ? startedAt : `${startedAt}Z`);
  if (!Number.isFinite(instant)) return null;
  return new Date(instant - (!hasZone(startedAt) && offset !== null ? offset * 60_000 : 0)).toISOString();
}

function localHour(input: ImportedTitleInput): number | null {
  const text = input.startedAt ?? "";
  const hour = text.match(/T(\d{2}):(\d{2})/i);
  if (!hour || Number(hour[1]) > 23 || Number(hour[2]) > 59 || !importedStartInstant(text)) return null;
  if (!hasZone(text)) return Number(hour[1]);
  const instant = new Date(text);
  const offset = importedUtcOffset(input.timezone);
  if (offset !== null) return new Date(instant.getTime() + offset * 60_000).getUTCHours();
  if (typeof input.timezone === "string" && input.timezone.trim()) {
    try {
      return Number(new Intl.DateTimeFormat("en-GB", { timeZone: input.timezone, hour: "2-digit", hourCycle: "h23" }).format(instant));
    } catch { /* Keep the datetime's own offset/wall hour if the zone is invalid. */ }
  }
  return Number(hour[1]);
}

export function importedLocalDate(input: ImportedTitleInput): string | null {
  const text = input.startedAt ?? "";
  if (localHour(input) === null) return null;
  if (hasZone(text)) {
    const offset = importedUtcOffset(input.timezone);
    if (offset !== null) return new Date(Date.parse(text) + offset * 60_000).toISOString().slice(0, 10);
    if (typeof input.timezone === "string" && input.timezone) {
      try {
        const parts = new Intl.DateTimeFormat("en-CA", { timeZone: input.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(text));
        const get = (kind: string) => parts.find(part => part.type === kind)!.value;
        return `${get("year")}-${get("month")}-${get("day")}`;
      } catch { /* Use the date encoded by the provider when the zone is invalid. */ }
    }
  }
  return text.slice(0, 10);
}

export function generateImportedActivityBaseTitle(input: ImportedTitleInput) {
  if (!isGenericImportedTitle(input)) return input.providerTitle!.trim();
  const activity = labels[input.activityType] ?? labels.other;
  const hour = localHour(input);
  if (hour === null) return activity[0].toUpperCase() + activity.slice(1);
  const time = hour < 4 ? "Night" : hour < 7 ? "Early morning" : hour < 12 ? "Morning" : hour < 14 ? "Lunchtime" : hour < 17 ? "Afternoon" : "Evening";
  return `${time} ${activity}`;
}

export const isValidRoutePoint = (point: RoutePoint) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng)
  && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180 && !(point.lat === 0 && point.lng === 0);

function distance(a: RoutePoint, b: RoutePoint) {
  const rad = Math.PI / 180;
  const d = Math.sin((b.lat - a.lat) * rad / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lng - a.lng) * rad / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(d), Math.sqrt(Math.max(0, 1 - d)));
}

/** Choose ~150m along the path (interpolate sparse points), never the start.
 * Short/invalid tracks with <100m of usable path get no locality. */
export function approximateStartPoint(route: RoutePoint[] = []): RoutePoint | null {
  let previous: RoutePoint | null = null;
  let origin: RoutePoint | null = null;
  let travelled = 0;
  for (const point of route) {
    if (!isValidRoutePoint(point)) continue;
    origin ??= point;
    if (previous) {
      const segment = distance(previous, point);
      if (travelled + segment >= 150 && segment > 0) {
        const fraction = (150 - travelled) / segment;
        const deltaLng = ((point.lng - previous.lng + 540) % 360) - 180;
        const candidate = { lat: previous.lat + (point.lat - previous.lat) * fraction, lng: ((previous.lng + deltaLng * fraction + 540) % 360) - 180 };
        return distance(origin, candidate) >= 100 ? candidate : null;
      }
      travelled += segment;
    }
    previous = point;
  }
  return travelled >= 100 && origin && previous && distance(origin, previous) >= 100 ? previous : null;
}

export function sensibleLocality(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (!name || name.length > 100 || !/\p{L}/u.test(name) || /[\d,\n\r/\\+<>]/.test(name)
    || /\b(street|road|avenue|boulevard|straat|laan|rue|strasse|straße)\b/i.test(name)) return null;
  return name;
}

export async function generateImportedActivityTitle(input: ImportedTitleInput, options: {
  resolveLocality?: (point: RoutePoint) => Promise<string | null>;
} = {}) {
  const base = generateImportedActivityBaseTitle(input);
  if (!isGenericImportedTitle(input) || !options.resolveLocality) return base;
  const point = approximateStartPoint(input.route ?? []);
  if (!point) return base;
  try {
    const locality = sensibleLocality(await options.resolveLocality(point));
    return locality ? `${base} ${locality}` : base;
  } catch { return base; }
}
