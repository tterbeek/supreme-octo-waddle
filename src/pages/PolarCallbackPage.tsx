import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { consumePolarState, exchangePolarCode, importPolarActivities } from "../services/polar.service";
import FormPage from "../components/forms/FormPage";

export default function PolarCallbackPage() {
  const navigate = useNavigate();
  const handled = useRef(false);
  const [message, setMessage] = useState("Finishing Polar connection...");
  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    void (async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("error")) throw new Error("Polar authorization was cancelled or denied.");
      const code = params.get("code");
      if (!code || !consumePolarState(params.get("state"))) throw new Error("Polar authorization could not be verified. Please try again.");
      await exchangePolarCode(code);
      setMessage("Polar connected. Importing workouts...");
      await importPolarActivities();
      navigate("/settings/connections", { replace: true });
    })().catch((error) => setMessage(error instanceof Error ? error.message : "Could not connect Polar."));
  }, [navigate]);
  return <FormPage title="Polar integration" backTo="/settings/connections">
    <p role="status" className="rounded-xl border border-warm-200 bg-warm-100 p-4 text-sm">{message}</p>
    <Link className="mt-4 block text-sm text-movenotes-primary underline" to="/settings/connections">Back to connections</Link>
  </FormPage>;
}
