import { trackImportSync } from './activityImport.service';
import { supabase } from "../supabaseClient";

const STATE_KEY = "polar_oauth_state";
const CALLBACK_PATH = "/settings/polar/callback";
const STALE_MS = 30 * 60 * 1000;
export const POLAR_SYNC_COMPLETED_EVENT = "movenotes:polar-sync-completed";

export type PolarConnection = { connected: boolean; last_synced_at: string | null };

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    const response = error.context as Response | undefined;
    const payload = await response?.clone().json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error || error.message);
  }
  return data as T;
}

export function polarRedirectUri() {
  return `${window.location.origin}${CALLBACK_PATH}`;
}

export function startPolarOAuth() {
  const clientId = import.meta.env.VITE_POLAR_CLIENT_ID;
  if (!clientId) throw new Error("Polar client ID is not configured.");
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const state = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const statePayload = JSON.stringify({ state, at: Date.now() });
  sessionStorage.setItem(STATE_KEY, statePayload);
  localStorage.setItem(STATE_KEY, statePayload);
  const query = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: polarRedirectUri(),
    scope: "training_sessions:read sports:read",
    state,
  });
  return `https://auth.polar.com/oauth/authorize?${query}`;
}

export function consumePolarState(received: string | null) {
  const raw = sessionStorage.getItem(STATE_KEY) || localStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(STATE_KEY);
  localStorage.removeItem(STATE_KEY);
  if (!raw || !received) return false;
  try {
    const stored = JSON.parse(raw) as { state: string; at: number };
    return stored.state === received && Date.now() - stored.at < 10 * 60_000;
  } catch { return false; }
}

export function exchangePolarCode(code: string) {
  return invoke<{ ok: boolean }>("polar-exchange-token", { code, redirectUri: polarRedirectUri() });
}

export function fetchPolarConnection() {
  return invoke<PolarConnection>("polar-connection", {});
}

export function disconnectPolar() {
  return invoke<PolarConnection>("polar-connection", { disconnect: true });
}

type ImportResult = { ok: boolean; fetched: number; inserted: number; skipped: number };
export const POLAR_PULL_COOLDOWN_MS = 60_000;
const importPromises = new Map<string, Promise<ImportResult>>();
const syncPromises = new Map<string, { cooldownMs: number; promise: Promise<boolean> }>();
const lastAttempts = new Map<string, number>();
const backoffs = new Map<string, number>();

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

export async function importPolarActivities() {
  const userId = await currentUserId();
  if (!userId) throw new Error('Sign in to sync Polar.');
  const running = importPromises.get(userId);
  if (running) return running;
  const work = (async () => {
    if (Date.now() < (backoffs.get(userId) ?? 0)) throw new Error('Polar is temporarily limiting requests. Please try again later.');
    lastAttempts.set(userId, Date.now());
    try {
      const result = await trackImportSync(() => invoke<ImportResult>('polar-import-activities', {}));
      if (result.inserted > 0) window.dispatchEvent(new Event(POLAR_SYNC_COMPLETED_EVENT));
      return result;
    } catch (error) {
      // The importer currently forwards provider errors as messages. Avoid
      // hammering a shared client limit until the short-term window resets.
      if (error instanceof Error && /\b429\b/.test(error.message)) backoffs.set(userId, Date.now() + 15 * 60_000);
      throw error;
    }
  })().finally(() => { importPromises.delete(userId); });
  importPromises.set(userId, work);
  return work;
}

/** Pull refresh uses 60s; existing automatic callers retain the 30-minute default. */
export async function syncPolarIfStale(cooldownMs = STALE_MS): Promise<boolean> {
  const userId = await currentUserId();
  if (!userId) return false;
  const runningImport = importPromises.get(userId);
  if (runningImport) { await runningImport; return true; }
  const running = syncPromises.get(userId);
  if (running) {
    const synced = await running.promise;
    // A manual pull can follow a less frequent automatic check that skipped.
    return synced || cooldownMs >= running.cooldownMs ? synced : syncPolarIfStale(cooldownMs);
  }
  const work = (async () => {
    if (Date.now() < (backoffs.get(userId) ?? 0)) throw new Error('Polar is temporarily limiting requests. Please try again later.');
    if (Date.now() - (lastAttempts.get(userId) ?? 0) < cooldownMs) return false;
    const connection = await fetchPolarConnection();
    if (!connection.connected) return false;
    const last = connection.last_synced_at ? Date.parse(connection.last_synced_at) : 0;
    if (Number.isFinite(last) && Date.now() - last < cooldownMs) return false;
    await importPolarActivities();
    return true;
  })().finally(() => { syncPromises.delete(userId); });
  syncPromises.set(userId, { cooldownMs, promise: work });
  return work;
}
