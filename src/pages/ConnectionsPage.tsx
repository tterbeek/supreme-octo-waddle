import { useEffect, useState } from "react";
import { IconLinkOff, IconRefresh } from "@tabler/icons-react";
import {
  disconnectUserStrava,
  fetchUserStravaConnection,
  importRecentStravaActivities,
  startStravaOAuth,
  type UserStravaConnection,
} from "../services/strava.service";

export default function ConnectionsPage() {
  const [loadingStrava, setLoadingStrava] = useState(true);
  const [connectingStrava, setConnectingStrava] = useState(false);
  const [disconnectingStrava, setDisconnectingStrava] = useState(false);
  const [importingStrava, setImportingStrava] = useState(false);
  const [stravaConnection, setStravaConnection] =
    useState<UserStravaConnection | null>(null);
  const [stravaError, setStravaError] = useState<string | null>(null);
  const [stravaImportResult, setStravaImportResult] = useState<string | null>(null);

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

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-6 text-gray-800">Manage connections</h1>

      <div className="w-full bg-warm-100 border border-warm-200 px-4 py-3 rounded-xl mb-4">
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
                connectingStrava || loadingStrava || disconnectingStrava || importingStrava
              }
              className="inline-flex items-center justify-center disabled:opacity-60"
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
                disabled={importingStrava || loadingStrava || disconnectingStrava}
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
          <p className="text-xs text-red-700 mt-2 text-center">{stravaError}</p>
        )}
      </div>
    </div>
  );
}
