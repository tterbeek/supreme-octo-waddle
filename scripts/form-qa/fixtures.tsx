// Dev-only fictional fixtures. Not imported by the app or included in dist.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../src/supabaseClient";
import { UnitContext } from "../../src/contexts/UnitContext";
import FormNavigationGuard from "../../src/components/forms/FormNavigationGuard";
import { allowFormNavigation } from "../../src/lib/formLifecycle";
import AddActivityForm from "../../src/features/activities/AddActivityForm";
import EditActivityModal from "../../src/features/activities/EditActivityModal";
import AddNoteModal from "../../src/components/AddNoteModal";
import JournalEntryModal from "../../src/components/JournalEntryModal";
import AddPresetModal from "../../src/features/presets/AddPresetModal";
import EditPresetModal from "../../src/features/presets/EditPresetModal";
import AddPresetPage from "../../src/pages/AddPresetPage";
import EquipmentFormSheet from "../../src/components/EquipmentFormSheet";
import EquipmentDialog from "../../src/components/EquipmentDialog";
import ManageEquipmentPage from "../../src/pages/ManageEquipmentPage";
import AddGoalModal from "../../src/components/AddGoalModal";
import EditGoalModal from "../../src/components/EditGoalModal";
import DirectionAddModal from "../../src/components/DirectionAddModal";
import GoalDirectionSheet from "../../src/components/GoalDirectionSheet";
import MicroAdjustmentCreateModal from "../../src/components/MicroAdjustmentCreateModal";
import TinyTweakStrip from "../../src/components/TinyTweakStrip";
import WeeklyCompanionCard from "../../src/components/WeeklyCompanionCard";
import CompanionSettings from "../../src/components/CompanionSettings";
import AdminWeeklyCompanion from "../../src/components/AdminWeeklyCompanion";
import SettingsPage from "../../src/pages/SettingsPage";
import ActivityPreferencesPage from "../../src/pages/ActivityPreferencesPage";
import ManageCirclePage from "../../src/pages/ManageCirclePage";
import CircleInvitePage from "../../src/pages/CircleInvitePage";
import ConnectionsPage from "../../src/pages/ConnectionsPage";
import PolarCallbackPage from "../../src/pages/PolarCallbackPage";
import StravaCallbackPage from "../../src/pages/StravaCallbackPage";
import Login from "../../src/pages/Login";
import Signup from "../../src/pages/Signup";
import OnboardingWizard from "../../src/components/OnboardingWizard";
import OnboardingCarousel from "../../src/components/OnboardingCarousel";
import AddBottomSheet from "../../src/components/AddBottomSheet";
import { SelectActivityTypeModal } from "../../src/components/SelectActivityTypeModal";
import Sidebar from "../../src/components/Sidebar";
import GalleryLightbox from "../../src/components/GalleryLightbox";
import ActivityImageSheet from "../../src/components/ActivityImageSheet";
import "../../src/index.css";

const qa = (window as any).formQA = { fail: false, delay: 0, writes: [], invocations: [], saved: 0, closed: 0, case: "", network: [], select: (_name: string) => {} };
const originalFetch = window.fetch;
window.fetch = (input, init) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.includes("supabase") || url.includes(":54321")) { qa.network.push(url); return Promise.reject(new Error("QA blocks all Supabase network requests")); }
  return originalFetch(input, init);
};
const user = { id: "fictional-owner", email: "fictional@example.invalid", email_confirmed_at: "2026-10-01" };
const activity: any = { id: "fictional-activity", user_id: user.id, title: "A gentle morning walk", type: "walk", date: "2026-10-17", distance_km: 4, duration_min: 45, notes: "A private note that must be kept.", feeling_during: "smile", feeling_after: "happy", effort: 2, source: "manual", activity_equipment: [] };
const equipment: any[] = Array.from({ length: 45 }, (_, i) => ({ id: `equipment-${i}`, user_id: user.id, name: i === 0 ? "Walking shoes" : `Fictional equipment ${i + 1}`, notes: "A remembered detail.", is_active: true, created_at: "2026-01-01" }));
const presets: any[] = Array.from({ length: 18 }, (_, i) => ({ id: `preset-${i}`, user_id: user.id, name: `Gentle walk ${i + 1}`, type: "walk", distance_km: 4, duration_min: 45, effort: 2, equipment_ids: [], preset_equipment: [] }));
const goal: any = { id: "goal", user_id: user.id, activity_type: "walk", metric: "distance", target: 10, period: "week", name: "Room to move", updated_at: "2026-10-17" };
const tweak = { id: "tweak", text: "Leave room for a short walk", started_at: "2026-10-01", ended_at: "2026-10-10", end_flow_state: "prompt_reflection" };
const post: any = { id: "post", generated_at: "2026-10-12T07:00:00.123456+00:00", week_start: "2026-10-05", week_end: "2026-10-11", status: "ready", thought: "The running Direction you said mattered to you can sit alongside the way these outings felt. Reaching the distance you chose does not have to tell the whole story of the week.\n\nThere may be room to notice what that goal gave you, without making the next run a test of doing more. What part felt worth carrying with you?", user_reflection: "", sources: [{ kind: "direction", label: "Direction", detail: "20 distance per week\nComputed progress: 30.4 / 20 km · 0 km remaining\nPeriod: 2026-10-05–2026-10-11 · as of 2026-10-11" }], includes_activity_notes: false };
const rows: Record<string, any[]> = {
  activities: [activity], equipment, presets, goals: [goal], activity_equipment: [], preset_equipment: [], activity_photos: [], activity_preferences: [],
  user_activity_types: ["walk", "run", "ride", "yoga"].map((activity_type, i) => ({ user_id: user.id, activity_type, is_enabled: true, sort_order: i * 10 })),
  user_preferences: [{ user_id: user.id, social_display_name: "Fictional mover", login_email: user.email, unit_system: "metric" }],
  companion_preferences: [{ user_id: user.id, enabled: false, allow_activity_notes: false, time_zone: "Europe/Brussels" }],
  journal_entries: [], micro_adjustments: [], user_strava_connections: [], circle_connections: [],
  companion_feedback: [],
};
const wait = () => new Promise(resolve => setTimeout(resolve, qa.delay));
const auth: any = supabase.auth;
auth.getUser = async () => ({ data: { user: qa.case === "admin-weekly" ? { ...user, email: "me@thijsterbeek.com" } : user }, error: null });
auth.getSession = async () => ({ data: { session: { user, access_token: "fictional-not-a-token" } }, error: null });
auth.onAuthStateChange = () => ({ data: { subscription: { unsubscribe() {} } } });
auth.signInWithOtp = async () => { await wait(); return { error: qa.fail ? { message: "Simulated auth error" } : null }; };
auth.verifyOtp = async () => { await wait(); return { data: { session: { user }, user }, error: qa.fail ? { message: "Simulated auth error" } : null }; };
(supabase as any).from = (table: string) => {
  let op = "read"; let payload: any; let filters: any[] = []; let selection = "";
  const result = async (single = false) => {
    if (op !== "read") { qa.writes.push({ table, op, payload, filters }); await wait(); }
    if (op !== "read" && qa.fail) return { data: null, error: { message: "Simulated save error" }, count: 0 };
    let data = rows[table] || [];
    if (table === "companion_feedback") {
      data = data.filter(row => filters.every(([key, value]) => row[key] === value));
      if (op === "delete") rows[table] = rows[table].filter(row => !data.includes(row));
      return { data: single ? data[0] || null : data, error: null };
    }
    if (table === "micro_adjustments" && filters.some(([key, value]) => key === "status" && value === "ended")) data = [tweak];
    if (table === "activities" && selection === "id") data = [];
    if (op !== "read") data = [{ ...(data[0] || {}), ...(Array.isArray(payload) ? payload[0] : payload), id: data[0]?.id || "fictional-saved" }];
    return { data: single ? data[0] || null : data, error: null, count: 0 };
  };
  const q: any = {};
  q.select = (value = "*") => { selection = value; return q; };
  q.eq = (key: string, value: unknown) => { filters.push([key, value]); return q; };
  for (const method of ["insert", "update", "upsert", "delete"]) q[method] = (value: unknown) => { op = method; payload = value; return q; };
  for (const method of ["order", "limit", "gte", "lte", "gt", "lt", "in", "is", "not", "or", "range", "neq"]) q[method] = () => q;
  q.single = q.maybeSingle = () => result(true);
  q.then = (resolve: any, reject: any) => result().then(resolve, reject);
  return q;
};
(supabase as any).rpc = async (name: string, args: any) => {
  if (name === "save_companion_feedback") {
    qa.writes.push({ table: name, payload: args }); await wait();
    if (qa.fail) return { data: null, error: { message: "Simulated save error" } };
    const previous = rows.companion_feedback.find(row => row.post_id === args.p_post_id && row.output_generated_at === args.p_output_generated_at);
    const value = { post_id: args.p_post_id, output_generated_at: args.p_output_generated_at, rating: args.p_rating,
      comment: args.p_save_comment ? args.p_comment : previous?.comment ?? null, updated_at: new Date().toISOString() };
    rows.companion_feedback = [value];
    return { data: value, error: null };
  }
  if (name.startsWith("set_") || name.startsWith("accept_") || name.startsWith("create_") || name === "delete_companion_post") { qa.writes.push({ table: name, payload: args }); await wait(); if (qa.fail) return { data: null, error: { message: "Simulated save error" } }; }
  const data = name === "has_companion_access" ? true
    : name === "get_circle_invite_preview" ? [{ invite_status: "valid", friendly_name: "Fictional friend", account_email: "friend@example.invalid" }]
    : name.includes("micro_adjustment_suggestions") ? [1, 2, 3].map(id => ({ id: String(id), text: `Make room for a little movement ${id}`, category: "gentle" }))
    : name === "accept_circle_invite" ? "connected" : [];
  return { data, error: null };
};
Object.defineProperty(supabase, "functions", { value: { invoke: async (name: string, options: unknown) => {
  qa.invocations.push({ name, options }); await wait();
  if (name === "weekly-companion") return { data: { status: "ready", ...((options as any)?.body?.store_test_request ? { diagnostics: {
    request_timestamp: "2026-10-20T12:00:00Z", endpoint: "https://api.openai.com/v1/responses", requested_model: "fixture-model", model: "fixture-model",
    response_id: "resp_fictional", request_id: "req_fictional", project_id: "proj_fictional", store_requested: true, store_returned: true, http_status: 200,
  } } : {}) }, error: qa.fail ? { message: "Simulated generation error" } : null };
  return { data: { connected: false, fetched: 0, inserted: 0, skipped: 0 }, error: null };
} } });
(supabase.storage as any).from = () => ({ createSignedUrls: async () => ({ data: [], error: null }), download: async () => ({ data: null, error: { message: "Fictional missing photo" } }), upload: async () => ({ data: {}, error: null }), remove: async () => ({ error: null }) });
HTMLMediaElement.prototype.play = async () => {};

function Scenario({ name, close, saved }: { name: string; close: () => void; saved: () => void }) {
  switch (name) {
    case "log": return <AddActivityForm initialType="walk" onClose={close} onLogged={saved} />;
    case "import": return <AddActivityForm existingActivity={{ ...activity, source: "polar", user_enrichment_status: "pending" }} onClose={close} onLogged={saved} />;
    case "edit": return <EditActivityModal activity={activity} onClose={close} onUpdated={saved} onDeleted={saved} />;
    case "edit-reflection": return <EditActivityModal activity={activity} reflectionOnly onClose={close} onUpdated={saved} onDeleted={saved} />;
    case "note": return <AddNoteModal activityId={activity.id} onSkip={close} onSave={() => { saved(); close(); }} />;
    case "journal": return <JournalEntryModal open onClose={close} onSaved={saved} />;
    case "journal-edit": return <JournalEntryModal open entry={{ id: "note", text: "Existing words", entry_type: "journal_note" }} onClose={close} onSaved={saved} />;
    case "preset-add": return <AddPresetModal initialType="walk" onClose={close} onSaved={() => { saved(); close(); }} />;
    case "preset-edit": return <EditPresetModal preset={presets[0]} onClose={close} onSaved={() => { saved(); close(); }} onDeleted={saved} />;
    case "preset-page": return <AddPresetPage />;
    case "equipment-add": return <EquipmentFormSheet title="Add equipment" primaryLabel="Add equipment" onClose={close} onSubmit={async () => { await wait(); if (qa.fail) return { ok: false, error: "Simulated save error" }; saved(); return { ok: true }; }} />;
    case "equipment-select": return <EquipmentDialog equipment={equipment} selectedEquipmentIds={[]} onChange={saved} onClose={close} onAddEquipment={async name => ({ ...equipment[0], id: "added", name })} />;
    case "equipment-page": return <ManageEquipmentPage />;
    case "direction-choice": return <DirectionAddModal open onClose={close} onSelectDirection={saved} onSelectMicroAdjustment={saved} />;
    case "direction-measures": return <GoalDirectionSheet group={{ activity_type: "walk", period: "week", goals: [{ ...goal, goal_id: goal.id, current_value: 4, progress_ratio: 0.4 }] }} onClose={close} onEditGoal={saved} onAddGoal={saved} />;
    case "direction-add": return <AddGoalModal onClose={close} onAdded={saved} onDuplicate={saved} existingGoals={[]} />;
    case "direction-edit": return <EditGoalModal goal={goal} onClose={close} onUpdated={saved} onDeleted={saved} />;
    case "tweak": return <MicroAdjustmentCreateModal open onClose={close} onCompleted={saved} />;
    case "tweak-adjust": return <MicroAdjustmentCreateModal open mode="adjust" activeTweak={tweak} onClose={close} onCompleted={saved} />;
    case "tweak-review": return <TinyTweakStrip userId={user.id} />;
    case "companion-response": return <WeeklyCompanionCard post={post} onSaved={saved} />;
    case "companion-settings": return <CompanionSettings onClose={close} />;
    case "admin-weekly": return <AdminWeeklyCompanion />;
    case "admin-weekly-denied": return <AdminWeeklyCompanion />;
    case "settings": return <SettingsPage />;
    case "activity-preferences": return <ActivityPreferencesPage />;
    case "circle-profile": return <ManageCirclePage />;
    case "circle-invite": return <CircleInvitePage />;
    case "connections": return <ConnectionsPage />;
    case "polar-callback": return <PolarCallbackPage />;
    case "strava-callback": return <StravaCallbackPage />;
    case "login": return <Login />;
    case "signup": return <Signup />;
    case "onboarding": return <OnboardingWizard onSkip={close} onComplete={close} />;
    case "welcome": return <OnboardingCarousel onSkip={close} onComplete={close} />;
    case "add-choice": return <AddBottomSheet open onClose={close} onSelectActivity={saved} onSelectJournalEntry={saved} />;
    case "type-choice": return <SelectActivityTypeModal open onClose={close} onSelect={saved} />;
    case "drawer": return <Sidebar open onClose={close} />;
    case "export": return <ActivityImageSheet activityId={activity.id} onClose={close} />;
    case "gallery": return <GalleryLightbox open items={[{ key: "one", activity, imagePath: null, thumbPath: null, photoId: null }]} activeIndex={0} onActiveIndexChange={() => {}} onClose={close} signedImages={{}} signedThumbs={{}} />;
    default: return null;
  }
}
function Harness() {
  const [name, setName] = useState(""); const [key, setKey] = useState(0); const [open, setOpen] = useState(false);
  const [unitSystem, setUnitSystem] = useState<"metric" | "imperial">("metric");
  const navigate = useNavigate(); const location = useLocation();
  qa.select = (value: string) => { allowFormNavigation(() => navigate(value === "circle-invite" ? "/circle/invite/fictional" : "/forms", { replace: true })); qa.case = value; qa.fail = false; qa.delay = 0; setName(value); setKey(n => n + 1); setOpen(true); };
  qa.checkpoint = () => allowFormNavigation(() => navigate("/forms?checkpoint=1"));
  qa.navigate = (to: string) => navigate(to);
  const close = () => { qa.closed++; setOpen(false); };
  return <UnitContext.Provider value={{ unitSystem, setUnitSystem }}><FormNavigationGuard />
    <main className="p-4" style={{ minHeight: 1800 }}><button type="button" onClick={() => setOpen(true)}>Open form</button><p>Fictional form QA only</p>
      {(location.pathname === "/forms" || location.pathname.startsWith("/circle/invite/")) && open && <Scenario key={key} name={name} close={close} saved={() => qa.saved++} />}
    </main>
  </UnitContext.Provider>;
}
const router = createBrowserRouter([{ path: "*", element: <Harness /> }, { path: "/circle/invite/:token", element: <Harness /> }]);
createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);
