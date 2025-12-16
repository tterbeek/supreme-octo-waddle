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
