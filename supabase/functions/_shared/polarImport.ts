export type PolarSession = {
  identifier?: { id?: string };
  startTime?: string;
  stopTime?: string;
  durationMillis?: number;
  distanceMeters?: number;
  exercises?: Array<{ distanceMeters?: number }>;
  name?: string;
  sport?: { id?: string | number };
};

export type PolarSport = {
  id?: { id?: string | number };
  name?: string;
  parentSport?: { id?: string | number };
};

// Polar v4 list endpoints can return a bare array, despite some examples showing wrappers.
export function polarList<T>(value: T[] | Record<string, unknown>, key: string): T[] {
  if (Array.isArray(value)) return value;
  const items = value[key];
  return Array.isArray(items) ? items as T[] : [];
}

// Polar's training-sessions/list parser expects a local date-time with no zone suffix.
export function polarRangeDateTime(value: Date): string {
  return `${value.toISOString().slice(0, 10)}T00:00:00`;
}

export function moveNotesType(sportName: string): string {
  const name = sportName.toLowerCase().replace(/[_-]/g, " ");
  if (/hiking|trekking/.test(name)) return "hike";
  if (/running|jogging|trail run/.test(name)) return "run";
  if (/cycling|biking|spinning|bike/.test(name)) return "ride";
  if (/walking|nordic walk/.test(name)) return "walk";
  if (/swimming|aqua/.test(name)) return "swim";
  if (/yoga/.test(name)) return "yoga";
  if (/strength|weight|gym|circuit|crossfit|pilates|hiit/.test(name)) return "strength";
  if (/meditation|mindfulness/.test(name)) return "meditation";
  if (/stretch|mobility|recovery/.test(name)) return "restore";
  return "other";
}

export function normalizePolarSession(
  session: PolarSession,
  sports: Map<string, PolarSport>,
  userId: string,
  importedAt: string,
) {
  const externalId = session.identifier?.id;
  const startMs = Date.parse(session.startTime ?? "");
  if (!externalId || !session.startTime || !session.stopTime || !Number.isFinite(startMs)) return null;
  const sport = sports.get(String(session.sport?.id));
  const parentSport = sports.get(String(sport?.parentSport?.id));
  const sportName = sport?.name ?? "Other";
  const type = moveNotesType(sportName) === "other"
    ? moveNotesType(parentSport?.name ?? "Other") : moveNotesType(sportName);
  const validDistance = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && value >= 0;
  const exerciseDistances = session.exercises?.map((exercise) => exercise.distanceMeters);
  const distanceMeters = validDistance(session.distanceMeters)
    ? session.distanceMeters
    : exerciseDistances?.length && exerciseDistances.every(validDistance)
    ? exerciseDistances.reduce((sum, distance) => sum + (distance as number), 0)
    : null;
  const distanceKm = distanceMeters === null ? null : Math.round(distanceMeters / 10) / 100;
  const durationMin = typeof session.durationMillis === "number" && Number.isFinite(session.durationMillis) && session.durationMillis >= 0
    ? Math.round(session.durationMillis / 60000) : null;
  return {
    user_id: userId,
    type,
    date: session.startTime.slice(0, 10),
    started_at: new Date(startMs).toISOString(),
    title: session.name?.trim() || sportName,
    distance_km: distanceKm,
    duration_min: durationMin,
    effort: null,
    source: "polar",
    external_source: "polar",
    external_id: externalId,
    raw_sport_type: sportName,
    imported_at: importedAt,
    user_enrichment_status: "pending",
  };
}
