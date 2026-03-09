import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  consumeAndValidateStravaState,
  exchangeStravaCode,
} from "../services/strava.service";

type CallbackStatus = "working" | "success" | "error";

export default function StravaCallbackPage() {
  const navigate = useNavigate();
  const hasHandledRef = useRef(false);
  const [status, setStatus] = useState<CallbackStatus>("working");
  const [message, setMessage] = useState("Finishing Strava connection...");

  useEffect(() => {
    if (hasHandledRef.current) return;
    hasHandledRef.current = true;

    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get("error");
      const code = params.get("code");
      const state = params.get("state");

      if (errorParam) {
        setStatus("error");
        setMessage("Strava authorization was cancelled or denied.");
        return;
      }

      if (!code) {
        setStatus("error");
        setMessage("Missing authorization code from Strava.");
        return;
      }

      const stateValid = consumeAndValidateStravaState(state);
      if (!stateValid) {
        setStatus("error");
        setMessage("Security validation failed. Please try connecting again.");
        return;
      }

      try {
        await exchangeStravaCode(code);
        setStatus("success");
        setMessage("Strava connected. Redirecting to settings...");
        window.setTimeout(() => {
          navigate("/settings", { replace: true });
        }, 1000);
      } catch (err: any) {
        setStatus("error");
        setMessage(err?.message || "Could not complete Strava connection.");
      }
    };

    void run();
  }, [navigate]);

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold mb-4 text-gray-800">
        Connect to Strava
      </h1>
      <div className="rounded-xl border border-warm-200 bg-warm-100 p-4">
        <p
          className={`text-sm ${
            status === "error" ? "text-red-700" : "text-gray-700"
          }`}
        >
          {message}
        </p>
      </div>
      {status === "error" && (
        <div className="mt-4">
          <Link className="text-sm text-movenotes-primary underline" to="/settings">
            Back to Settings
          </Link>
        </div>
      )}
    </div>
  );
}
