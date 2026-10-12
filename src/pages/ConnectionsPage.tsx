import { useEffect, useState } from "react";
import { IconLinkOff, IconRefresh } from "@tabler/icons-react";
import {
  disconnectUserStrava,
  fetchUserStravaConnection,
  importRecentStravaActivities,
  startStravaOAuth,
  STRAVA_INTEGRATION_PAUSED,
  STRAVA_PAUSED_NOTICE,
  type UserStravaConnection,
} from "../services/strava.service";
import {
  disconnectPolar, fetchPolarConnection, importPolarActivities, startPolarOAuth,
  type PolarConnection,
} from "../services/polar.service";

export default function ConnectionsPage() {
  const [loadingStrava, setLoadingStrava] = useState(true);
  const [connectingStrava, setConnectingStrava] = useState(false);
  const [disconnectingStrava, setDisconnectingStrava] = useState(false);
  const [importingStrava, setImportingStrava] = useState(false);
  const [stravaConnection, setStravaConnection] =
    useState<UserStravaConnection | null>(null);
  const [stravaError, setStravaError] = useState<string | null>(null);
  const [stravaImportResult, setStravaImportResult] = useState<string | null>(null);
  const [polarConnection, setPolarConnection] = useState<PolarConnection | null>(null);
  const [polarLoading, setPolarLoading] = useState(true);
  const [polarBusy, setPolarBusy] = useState(false);
  const [polarMessage, setPolarMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchPolarConnection().then((connection) => {
      if (!cancelled) setPolarConnection(connection);
    }).catch((error) => {
      if (!cancelled) setPolarMessage(error instanceof Error ? error.message : "Could not load Polar connection.");
    }).finally(() => { if (!cancelled) setPolarLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const syncPolar = async () => {
    setPolarBusy(true);
    setPolarMessage(null);
    try {
      const result = await importPolarActivities();
      setPolarMessage(`Fetched ${result.fetched} · imported ${result.inserted} · already present ${result.skipped}`);
      setPolarConnection(await fetchPolarConnection());
    } catch (error) {
      setPolarMessage(error instanceof Error ? error.message : "Could not import Polar workouts.");
    } finally { setPolarBusy(false); }
  };

  const removePolar = async () => {
    setPolarBusy(true);
    setPolarMessage(null);
    try {
      setPolarConnection(await disconnectPolar());
      setPolarMessage("Polar disconnected. Previously imported activities remain in your Journal.");
    } catch (error) {
      setPolarMessage(error instanceof Error ? error.message : "Could not disconnect Polar.");
    } finally { setPolarBusy(false); }
  };

  useEffect(() => {
    let cancelled = false;

    const loadStravaConnection = async () => {
      setLoadingStrava(true);
      try {
        const row = await fetchUserStravaConnection();
        if (!cancelled) {
          setStravaConnection(row);
        }
      } catch (err: any) {
        if (!cancelled) {
          setStravaError(err?.message || "Could not load Strava connection.");
        }
      } finally {
        if (!cancelled) {
          setLoadingStrava(false);
        }
      }
    };

    void loadStravaConnection();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleConnectStrava = async () => {
    setStravaError(null);
    setStravaImportResult(null);
    setConnectingStrava(true);
    try {
      const url = startStravaOAuth();
      window.location.href = url;
    } catch (err: any) {
      setStravaError(err?.message || "Could not start Strava connection.");
      setConnectingStrava(false);
    }
  };

  const handleDisconnectStrava = async () => {
    setStravaError(null);
    setStravaImportResult(null);
    setDisconnectingStrava(true);
    try {
      await disconnectUserStrava();
      setStravaConnection(null);
    } catch (err: any) {
      setStravaError(err?.message || "Could not disconnect Strava.");
    } finally {
      setDisconnectingStrava(false);
    }
  };

  const handleImportStrava = async () => {
    setStravaError(null);
    setStravaImportResult(null);
    setImportingStrava(true);

    try {
      const result = await importRecentStravaActivities(50, 1);
      setStravaImportResult(
        `Fetched ${result.fetched} · inserted ${result.inserted} · updated ${result.updated}`
      );
      const row = await fetchUserStravaConnection();
      setStravaConnection(row);
    } catch (err: any) {
      setStravaError(err?.message || "Could not import Strava activities.");
    } finally {
      setImportingStrava(false);
    }
  };

  const lastSyncedText =
    stravaConnection?.last_synced_at
      ? new Date(stravaConnection.last_synced_at).toLocaleString("en-GB")
      : null;
  const stravaApplicationInactive = stravaError?.startsWith(
    "Strava sync is unavailable because the Strava application is inactive."
  );

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-6 text-gray-800">Manage connections</h1>

      <section className="w-full bg-warm-100 border border-warm-200 px-4 py-3 rounded-xl mb-4">
        <h2 className="font-semibold text-movenotes-text">Polar Flow</h2>
        <p className="mt-1 text-sm text-gray-600">Completed workouts are imported into your Journal. You can add MoveNotes details and reflections later.</p>
        {polarLoading ? <p className="mt-3 text-xs text-gray-500">Checking connection...</p> : (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {polarConnection?.connected ? <>
              <span className="text-sm text-gray-700">Connected</span>
              <button type="button" onClick={syncPolar} disabled={polarBusy} className="px-3 py-2 rounded-full bg-movenotes-primary text-primary-text text-sm disabled:opacity-60">{polarBusy ? "Syncing..." : "Sync now"}</button>
              <button type="button" onClick={removePolar} disabled={polarBusy} className="px-3 py-2 rounded-full border border-warm-300 text-sm disabled:opacity-60">Remove connection</button>
            </> : <button type="button" onClick={() => {
              try { window.location.href = startPolarOAuth(); }
              catch (error) { setPolarMessage(error instanceof Error ? error.message : "Could not start Polar connection."); }
            }} className="px-3 py-2 rounded-full bg-movenotes-primary text-primary-text text-sm">Connect Polar</button>}
          </div>
        )}
        {polarConnection?.last_synced_at && <p className="mt-2 text-xs text-gray-500">Last sync {new Date(polarConnection.last_synced_at).toLocaleString("en-GB")}</p>}
        {polarMessage && <p role="status" className="mt-2 text-xs text-gray-700">{polarMessage}</p>}
      </section>

      <div className="w-full bg-warm-100 border border-warm-200 px-4 py-3 rounded-xl mb-4">
        {STRAVA_INTEGRATION_PAUSED && (
          <div role="status" className="rounded-lg border border-warm-300 bg-movenotes-surface p-3 text-sm text-gray-700">
            <p className="font-semibold text-movenotes-text">Strava integration paused</p>
            <p className="mt-1">{STRAVA_PAUSED_NOTICE}</p>
          </div>
        )}
        {loadingStrava ? (
          <p className="text-xs text-gray-500 text-center">Checking connection...</p>
        ) : !stravaConnection ? (
          <p className="text-xs text-gray-500 text-center">Not connected</p>
        ) : null}

        <div className="mt-3 flex flex-col items-center gap-2 text-center">
          {stravaConnection ? (
            <>
              <img
                src="/btn_strava_connect_with_white.svg"
                alt="Connected with Strava"
                className="h-10 w-auto"
              />
              <div className="text-xs text-gray-500 space-y-1">
                <p>Connected athlete #{stravaConnection.strava_athlete_id}</p>
                {lastSyncedText && <p>Last sync {lastSyncedText}</p>}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={handleConnectStrava}
              disabled={
                STRAVA_INTEGRATION_PAUSED || connectingStrava || loadingStrava || disconnectingStrava || importingStrava
              }
              className="inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Connect to Strava"
            >
              {connectingStrava ? (
                <span className="px-3 py-2 rounded-full bg-movenotes-primary text-primary-text text-sm font-medium">
                  Connecting...
                </span>
              ) : (
                <img
                  src="/btn_strava_connect_with_white.svg"
                  alt="Connect with Strava"
                  className="h-10 w-auto"
                />
              )}
            </button>
          )}
          {stravaConnection && (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleImportStrava}
                disabled={STRAVA_INTEGRATION_PAUSED || importingStrava || loadingStrava || disconnectingStrava}
                className="px-3 py-2 rounded-full bg-movenotes-primary text-primary-text text-sm font-medium disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                <IconRefresh size={16} stroke={2} />
                {importingStrava ? "Syncing..." : "Sync"}
              </button>
              <button
                type="button"
                onClick={handleDisconnectStrava}
                disabled={disconnectingStrava || loadingStrava || importingStrava}
                className="px-3 py-2 rounded-full border border-warm-300 text-sm text-gray-700 disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                <IconLinkOff size={16} stroke={2} />
                {disconnectingStrava ? "Disconnecting..." : "Disconnect"}
              </button>
            </div>
          )}
        </div>

        {stravaImportResult && (
          <p className="text-xs text-gray-600 mt-2 text-center">{stravaImportResult}</p>
        )}

        {stravaError && (
          <div className="text-xs text-red-700 mt-2 text-center space-y-1">
            <p>{stravaError}</p>
            {stravaApplicationInactive && (
              <a
                href="https://www.strava.com/settings/api"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Open Strava API Settings
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
