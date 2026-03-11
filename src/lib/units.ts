export type UnitSystem = "metric" | "imperial";

export function kmToMiles(km: number): number {
  return km * 0.621371;
}

export function milesToKm(mi: number): number {
  return mi / 0.621371;
}

export function formatDistance(km: number, unit: UnitSystem) {
  if (unit === "imperial") {
    return `${kmToMiles(km).toFixed(0)} mi`;
  }
  return `${km.toFixed(0)} km`;
}

export function roundDurationMinutes(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes < 0) return 0;
  return minutes > 0 ? Math.max(1, Math.round(minutes)) : 0;
}

export function formatDurationMinutes(minutes: number): string {
  return `${roundDurationMinutes(minutes)} min`;
}
