import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildCompanionSources, COMPANION_INSTRUCTIONS, previousCompletedWeek, readCompanionOutput,
} from "../_shared/companion.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
  status, headers: { ...headers, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json(405, { error: "Method not allowed." });
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authorization = req.headers.get("Authorization");
  if (!authorization) return json(401, { error: "Not authenticated." });
  const client = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return json(401, { error: "Not authenticated." });
  const { data: allowed, error: accessError } = await client.rpc("has_companion_access");
  if (accessError) return json(503, { error: "Couldn't check Companion access just now." });
  if (allowed !== true) return json(403, { error: "Weekly Companion is a Premium feature with limited early access." });
  const admin = createClient(url, serviceKey);
  let claim: string | null = null;
  let weekStart: string | null = null;
  try {
    const { data: prefs, error: prefsError } = await admin.from("companion_preferences")
      .select("enabled, allow_activity_notes, time_zone").eq("user_id", user.id).maybeSingle();
    if (prefsError) throw prefsError;
    if (!prefs?.enabled) return json(200, { status: "disabled" });
    let week;
    try { week = previousCompletedWeek(new Date(), prefs.time_zone); }
    catch { return json(400, { error: "Please save your Companion settings again to update the time zone." }); }
    weekStart = week.start;
    const { data: existing, error: existingError } = await admin.from("companion_posts")
      .select("status").eq("user_id", user.id).eq("week_start", week.start).maybeSingle();
    if (existingError) throw existingError;
    if (existing?.status === "ready") return json(200, { status: "ready" });
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json(503, { error: "Weekly Companion is not configured yet." });
    const model = Deno.env.get("COMPANION_MODEL") || "gpt-6-luna";
    const { data: token, error: claimError } = await admin.rpc("claim_weekly_companion", {
      p_user_id: user.id, p_week_start: week.start, p_time_zone: prefs.time_zone, p_notes: prefs.allow_activity_notes,
    });
    if (claimError) throw claimError;
    if (!token) return json(200, { status: "waiting", message: "Your weekly thought is being prepared, or will be available to retry later." });
    claim = token;

    const results = await Promise.all([
      admin.from("goals").select("activity_type, metric, period, target, name").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(30),
      admin.from("micro_adjustments").select("text").eq("user_id", user.id).eq("status", "active").order("started_at", { ascending: false }).limit(1),
      admin.from("journal_entries").select("text").eq("user_id", user.id).eq("entry_type", "tiny_tweak_reflection").order("created_at", { ascending: false }).limit(1),
      admin.from("activities").select(`type, date, title, duration_min, distance_km, feeling_during, feeling_after${prefs.allow_activity_notes ? ", notes" : ""}`)
        .eq("user_id", user.id).gte("date", week.start).lte("date", week.end).order("date", { ascending: false }).limit(201),
    ]);
    for (const result of results) if (result.error) throw result.error;
    const [goals, tweaks, reviews, activities] = results;
    const sources = buildCompanionSources({
      goals: goals.data ?? [], tweak: tweaks.data?.[0]?.text ?? null,
      lastReflection: reviews.data?.[0]?.text ?? null,
      activities: (activities.data ?? []) as unknown as Parameters<typeof buildCompanionSources>[0]["activities"],
      allowNotes: prefs.allow_activity_notes, activityLimitReached: (activities.data?.length ?? 0) > 200,
    });
    // Recheck consent immediately before sending any context to the provider.
    const { data: consent, error: consentError } = await admin.from("companion_preferences")
      .select("enabled, allow_activity_notes").eq("user_id", user.id).single();
    if (consentError) throw consentError;
    if (!consent.enabled || consent.allow_activity_notes !== prefs.allow_activity_notes) {
      await admin.from("companion_posts").update({ status: "pending", generation_token: null })
        .eq("user_id", user.id).eq("generation_token", claim);
      return json(200, { status: "preferences_changed" });
    }
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", signal: AbortSignal.timeout(45_000),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, store: false, max_output_tokens: 500, instructions: COMPANION_INSTRUCTIONS,
        ...(model === "gpt-6-luna" ? { reasoning: { effort: "none" } } : {}),
        input: JSON.stringify({ completed_week: week, activity_notes_allowed: prefs.allow_activity_notes, records: sources }),
      }),
    });
    if (!response.ok) throw new Error(`AI request failed (${response.status}).`);
    const thought = readCompanionOutput(await response.json());
    const { data: saved, error: saveError } = await admin.rpc("finish_weekly_companion", {
      p_user_id: user.id, p_week_start: week.start, p_token: claim, p_notes: prefs.allow_activity_notes,
      p_thought: thought, p_sources: sources, p_model: model,
    });
    if (saveError) throw saveError;
    return json(200, { status: saved ? "ready" : "preferences_changed" });
  } catch {
    // Do not log private source records, model responses, tokens or provider errors.
    if (claim && weekStart) await admin.from("companion_posts")
      .update({ status: "failed", generation_token: null })
      .eq("user_id", user.id).eq("week_start", weekStart).eq("generation_token", claim);
    return json(503, { error: "Couldn't prepare your weekly thought just now. Please try again later." });
  }
});
