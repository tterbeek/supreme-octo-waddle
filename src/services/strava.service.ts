import { supabase } from "../supabaseClient";

const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_CALLBACK_PATH_DEFAULT = "/settings/strava/callback";
const STRAVA_OAUTH_STATE_KEY = "strava_oauth_state";
const STRAVA_OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;
const STRAVA_AUTO_SYNC_STALE_MS = 30 * 60 * 1000;

export const STRAVA_SYNC_COMPLETED_EVENT = "movenotes:strava-sync-completed";

export type UserStravaConnection = {
  user_id: string;
  strava_athlete_id: string;
  token_expires_at: string;
  created_at: string | null;
  updated_at: string | null;
  last_synced_at?: string | null;
};

const getRequiredClientId = () => {
  const clientId = import.meta.env.VITE_STRAVA_CLIENT_ID;
  if (!clientId) {
    throw new Error("Missing VITE_STRAVA_CLIENT_ID");
  }
  return clientId;
};

const getRedirectUri = () => {
  const callbackPath =
    import.meta.env.VITE_STRAVA_REDIRECT_PATH || STRAVA_CALLBACK_PATH_DEFAULT;
  return `${window.location.origin}${callbackPath}`;
};

const createState = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};

const writeOAuthState = (value: string) => {
  // Keep state in both storages: sessionStorage can be lost on mobile OAuth return.
  const payload = JSON.stringify({ state: value, createdAt: Date.now() });
  sessionStorage.setItem(STRAVA_OAUTH_STATE_KEY, payload);
  localStorage.setItem(STRAVA_OAUTH_STATE_KEY, payload);
};

const consumeOAuthState = () => {
  const sessionValue = sessionStorage.getItem(STRAVA_OAUTH_STATE_KEY);
  const localValue = localStorage.getItem(STRAVA_OAUTH_STATE_KEY);
  sessionStorage.removeItem(STRAVA_OAUTH_STATE_KEY);
  localStorage.removeItem(STRAVA_OAUTH_STATE_KEY);
  return sessionValue || localValue;
};

export const startStravaOAuth = () => {
  const clientId = getRequiredClientId();
  const redirectUri = getRedirectUri();
  const state = createState();
  const scope = import.meta.env.VITE_STRAVA_SCOPE || "read,activity:read_all";

  writeOAuthState(state);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    approval_prompt: "auto",
    scope,
    state,
  });

  return `${STRAVA_AUTHORIZE_URL}?${params.toString()}`;
};

export const consumeAndValidateStravaState = (returnedState: string | null) => {
  const raw = consumeOAuthState();

  if (!raw || !returnedState) return false;

  try {
    const parsed = JSON.parse(raw) as { state?: string; createdAt?: number };
    if (!parsed.state || !parsed.createdAt) return false;
    if (Date.now() - parsed.createdAt > STRAVA_OAUTH_STATE_MAX_AGE_MS) return false;
    return parsed.state === returnedState;
  } catch {
    return false;
  }
};

export const exchangeStravaCode = async (code: string) => {
  const redirectUri = getRedirectUri();

  const { data, error } = await supabase.functions.invoke(
    "strava-exchange-token",
    {
      body: { code, redirectUri },
    }
  );

  if (error) {
    const contextResponse = (error as any)?.context as Response | undefined;
    if (contextResponse) {
      try {
        const body = await contextResponse.json();
        if (body?.error && typeof body.error === "string") {
          throw new Error(body.error);
        }
      } catch {
        // fall through to generic message
      }
    }
    throw new Error(error.message || "Could not complete Strava connection.");
  }

  return data;
};

export const fetchUserStravaConnection = async () => {
  const selectWithSync =
    "user_id, strava_athlete_id, token_expires_at, created_at, updated_at, last_synced_at";
  const selectBase =
    "user_id, strava_athlete_id, token_expires_at, created_at, updated_at";

  const { data, error } = await supabase
    .from("user_strava_connections")
    .select(selectWithSync)
    .maybeSingle();

  if (error) {
    const message = error.message?.toLowerCase?.() || "";
    const missingLastSynced = message.includes("last_synced_at");
    if (!missingLastSynced) throw error;

    const fallback = await supabase
      .from("user_strava_connections")
      .select(selectBase)
      .maybeSingle();

    if (fallback.error) throw fallback.error;
    if (!fallback.data) return null;

    return {
      ...fallback.data,
      strava_athlete_id: String(fallback.data.strava_athlete_id),
      last_synced_at: null,
    } as UserStravaConnection;
  }

  if (!data) return null;

  return {
    ...data,
    strava_athlete_id: String(data.strava_athlete_id),
  } as UserStravaConnection;
};

export const disconnectUserStrava = async () => {
  const { error } = await supabase.functions.invoke("strava-disconnect", {
    body: {},
  });

  if (error) {
    const contextResponse = (error as any)?.context as Response | undefined;
    if (contextResponse) {
      try {
        const body = await contextResponse.json();
        if (body?.error && typeof body.error === "string") {
          throw new Error(body.error);
        }
      } catch {
        // fall through to generic message
      }
    }
    throw new Error(error.message || "Could not disconnect Strava.");
  }
};

export const importRecentStravaActivities = async (perPage = 50, page = 1) => {
  const { data, error } = await supabase.functions.invoke(
    "strava-import-activities",
    {
      body: { perPage, page },
    }
  );

  if (error) {
    const contextResponse = (error as any)?.context as Response | undefined;
    if (contextResponse) {
      try {
        const body = await contextResponse.json();
        if (body?.error && typeof body.error === "string") {
          throw new Error(body.error);
        }
      } catch {
        // fall through to generic message
      }
    }
    throw new Error(error.message || "Could not import Strava activities.");
  }

  return data as {
    ok: boolean;
    fetched: number;
    inserted: number;
    updated: number;
    synced_at: string;
  };
};

let autoSyncPromise: Promise<boolean> | null = null;

const parseTimestamp = (value?: string | null) => {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

export const shouldAutoSyncStrava = (
  connection: UserStravaConnection,
  staleMs = STRAVA_AUTO_SYNC_STALE_MS
) => {
  const lastSyncMs = parseTimestamp(connection.last_synced_at ?? null);
  if (lastSyncMs === null) return true;
  return Date.now() - lastSyncMs >= staleMs;
};

export const syncStravaIfStale = async (opts?: {
  staleMinutes?: number;
  perPage?: number;
  page?: number;
}) => {
  if (autoSyncPromise) return autoSyncPromise;

  autoSyncPromise = (async () => {
    const staleMs = Math.max(1, opts?.staleMinutes ?? 30) * 60 * 1000;
    const perPage = Math.max(1, Math.min(100, opts?.perPage ?? 50));
    const page = Math.max(1, opts?.page ?? 1);

    const connection = await fetchUserStravaConnection();
    if (!connection) return false;
    if (!shouldAutoSyncStrava(connection, staleMs)) return false;

    await importRecentStravaActivities(perPage, page);
    return true;
  })().finally(() => {
    autoSyncPromise = null;
  });

  return autoSyncPromise;
};
