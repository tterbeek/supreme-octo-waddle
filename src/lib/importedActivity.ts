export type ImportedActivity = {
  id: string;
  user_id?: string | null;
  type: string;
  source?: string | null;
  external_source?: string | null;
  user_enrichment_status?: string | null;
  date: string;
  distance_km?: number | null;
  duration_min?: number | null;
  title?: string | null;
  effort?: number | null;
  feeling_during?: string | null;
  feeling_after?: string | null;
  activity_equipment?: Array<{ equipment?: { id: string } | null }>;
  equipment?: Array<{ id: string }>;
};

export function needsImportedEnrichment(activity: ImportedActivity): boolean {
  return activity.source !== "manual" &&
    Boolean(activity.source || activity.external_source) &&
    activity.user_enrichment_status === "pending";
}
