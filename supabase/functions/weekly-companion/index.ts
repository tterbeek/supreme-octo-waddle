import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildCompanionSources, canRunWeeklyNow, COMPANION_INSTRUCTIONS, previousCompletedWeek, readCompanionOutput,
} from "../_shared/companion.ts";
import { FEEDBACK_GUIDANCE_INSTRUCTIONS, loadFeedbackGuidance } from "../_shared/companionFeedback.ts";
import { companionRunDiagnostics, storeCompanionTestRequest, type CompanionRunDiagnostics } from "../_shared/companionDiagnostics.ts";
import { loadDirectionProgress } from "../_shared/companionDirectionProgress.ts";

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
  const input = await req.json().catch(() => ({}));
  const manual = input?.manual === true;
  const storeTestRequest = storeCompanionTestRequest(user, input);
  if (manual && !canRunWeeklyNow(user)) return json(403, { error: "Manual weekly runs are restricted to the owner account." });
  const { data: allowed, error: accessError } = await client.rpc("has_companion_access");
  if (accessError) return json(503, { error: "Couldn't check Companion access just now." });
  if (allowed !== true) return json(403, { error: "Weekly Companion is a Premium feature with limited early access." });
  const admin = createClient(url, serviceKey);
  let claim: string | null = null;
  let weekStart: string | null = null;
  let diagnostics: CompanionRunDiagnostics | null = null;
  const releaseClaim = async (status: "pending" | "failed") => {
    if (!claim) return;
    // Never hide/overwrite a previous ready thought or restore deleted/redacted data.
    await admin.from("companion_posts").update({ status, generation_token: null })
      .eq("user_id", user.id).eq("generation_token", claim).eq("status", "generating");
    await admin.from("companion_posts").update({ generation_token: null })
      .eq("user_id", user.id).eq("generation_token", claim);
  };
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
    if (!manual && existing?.status === "ready") return json(200, { status: "ready" });
    if (!manual && existing?.status === "dismissed") return json(200, { status: "dismissed" });
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json(503, { error: "Weekly Companion is not configured yet." });
    const model = Deno.env.get("COMPANION_MODEL") || "gpt-6-luna";
    const { data: token, error: claimError } = await admin.rpc(manual ? "claim_manual_weekly_companion" : "claim_weekly_companion", {
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
      // Only the authenticated user's own words, never previous generated claims.
      // RLS also excludes disabled/inaccessible posts; deleted posts stay excluded.
      client.from("companion_posts").select("week_start, user_reflection")
        .eq("user_id", user.id).in("status", ["ready", "redacted"])
        .not("user_reflection", "is", null).neq("user_reflection", "")
        .gte("week_start", new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10))
        .lte("week_start", week.start)
        .order("week_start", { ascending: false }).limit(3),
    ]);
    for (const result of results) if (result.error) throw result.error;
    const [goals, tweaks, reviews, activities, companionReflections] = results;
    const directionProgress = await loadDirectionProgress(goals.data ?? [], week.end, ({ start, end, offset, limit }) =>
      client.from("activities").select("type, date, distance_km, duration_min")
        .eq("user_id", user.id).gte("date", start).lte("date", end)
        .order("date", { ascending: true }).order("id", { ascending: true }).range(offset, offset + limit - 1)
    );
    const sources = buildCompanionSources({
      goals: goals.data ?? [], tweak: tweaks.data?.[0]?.text ?? null,
      lastReflection: reviews.data?.[0]?.text ?? null,
      activities: (activities.data ?? []) as unknown as Parameters<typeof buildCompanionSources>[0]["activities"],
      allowNotes: prefs.allow_activity_notes, activityLimitReached: (activities.data?.length ?? 0) > 200,
      companionReflections: companionReflections.data ?? [],
      directionProgress,
    });
    const feedbackGuidance = await loadFeedbackGuidance(() => client.rpc("recent_companion_feedback", { p_content_type: "weekly_thought" }));
    // Recheck consent immediately before sending any context to the provider.
    const { data: consent, error: consentError } = await admin.from("companion_preferences")
      .select("enabled, allow_activity_notes").eq("user_id", user.id).single();
    if (consentError) throw consentError;
    if (!consent.enabled || consent.allow_activity_notes !== prefs.allow_activity_notes) {
      await releaseClaim("pending");
      return json(200, { status: "preferences_changed" });
    }
    const requestTimestamp = new Date().toISOString();
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", signal: AbortSignal.timeout(45_000),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, store: storeTestRequest, max_output_tokens: 500, instructions: `${COMPANION_INSTRUCTIONS}\n\n${FEEDBACK_GUIDANCE_INSTRUCTIONS}`,
        ...(model === "gpt-6-luna" ? { reasoning: { effort: "none" } } : {}),
        input: JSON.stringify({ completed_week: week, activity_notes_allowed: prefs.allow_activity_notes, records: sources, feedback_guidance: feedbackGuidance }),
      }),
    });
    const payload = await response.json().catch(() => null);
    if (storeTestRequest) {
      diagnostics = companionRunDiagnostics(requestTimestamp, model, response, payload);
      // Full request/response storage is in OpenAI only, and only for this test.
      console.info(JSON.stringify({ event: "weekly_companion_stored_test", ...diagnostics }));
    }
    if (!response.ok) throw new Error(`AI request failed (${response.status}).`);
    const thought = readCompanionOutput(payload);
    const { data: saved, error: saveError } = await admin.rpc("finish_weekly_companion", {
      p_user_id: user.id, p_week_start: week.start, p_token: claim, p_notes: prefs.allow_activity_notes,
      p_thought: thought, p_sources: sources, p_model: model,
    });
    if (saveError) throw saveError;
    return json(200, { status: saved ? "ready" : "preferences_changed", ...(diagnostics ? { diagnostics } : {}) });
  } catch {
    // Do not log private source records, model responses, tokens or provider errors.
    if (claim && weekStart) await releaseClaim("failed");
    return json(503, { error: "Couldn't prepare your weekly thought just now. Please try again later.", ...(diagnostics ? { diagnostics } : {}) });
  }
});
