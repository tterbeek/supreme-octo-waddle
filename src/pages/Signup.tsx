// src/pages/Signup.tsx
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";

interface SignupProps {
  onSignup?: (session: any) => void;
}

export default function Signup({ onSignup }: SignupProps) {
  const location = useLocation();
  const prefilledEmail = (location.state as { email?: string } | null)?.email || "";
  const [email, setEmail] = useState(prefilledEmail);
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  const navigate = useNavigate();

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  // 1️⃣ Request OTP for signup
  const handleSendOtp = async () => {
    if (!isValidEmail(email)) {
      alert("Please enter a valid email address.");
      return;
    }
    if (!consentPrivacy || !consentTerms) {
      alert("You must accept the Privacy Policy and Terms of Use.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setLoading(false);

    if (error) {
      console.error("[Signup] Error sending OTP:", error);
      alert(error.message);
    } else {
      setCodeSent(true);
    }
  };

  // 2️⃣ Verify OTP and log in the user
  const handleVerifyOtp = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });
    setLoading(false);

    if (error) {
      console.error("[Signup] OTP verification error:", error);
      alert(error.message);
      return;
    }

    const session = data?.session;
    const user = session?.user ?? data?.user ?? null;

    if (!session || !user) {
      console.error("[Signup] No active session returned after OTP verification.");
      alert("We couldn't complete the signup. Please try again.");
      return;
    }

    onSignup?.(session);

    // ✅ Store consent record (best-effort, non-blocking)
    try {
      const { error: consentError } = await supabase
        .from("user_consents")
        .insert([
          {
            user_id: user.id,
            accepted_privacy_policy: true,
            accepted_terms: true,
            privacy_policy_version: "v1.0",
            terms_version: "v1.0",
          },
        ]);

      if (consentError) {
        console.error("[Signup] Error saving consent:", consentError.message);
      }
    } catch (err) {
      console.error("[Signup] Unexpected error saving consent:", err);
    }

    // ✅ Redirect to main app
    navigate("/");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-movenotes-bg text-movenotes-text">
      <div className="w-full max-w-md p-6 bg-movenotes-surface shadow-sm rounded-2xl">
        <h1 className="text-2xl font-semibold text-center text-movenotes-primary mb-6">
          Create Your MoveNotes Account
        </h1>

        {!codeSent ? (
          <div className="flex flex-col space-y-4">
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-movenotes-border bg-movenotes-bg text-movenotes-text rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-movenotes-primary"
            />

            <div className="flex items-start space-x-2 text-sm">
              <input
                type="checkbox"
                id="privacy"
                checked={consentPrivacy}
                onChange={(e) => setConsentPrivacy(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="privacy">
                I agree to the{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-movenotes-accent underline hover:opacity-80"
                >
                  Privacy Policy
                </a>
              </label>
            </div>

            <div className="flex items-start space-x-2 text-sm">
              <input
                type="checkbox"
                id="terms"
                checked={consentTerms}
                onChange={(e) => setConsentTerms(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="terms">
                I agree to the{" "}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-movenotes-accent underline hover:opacity-80"
                >
                  Terms of Use
                </a>
              </label>
            </div>

            <button
              onClick={handleSendOtp}
              disabled={loading}
              className="w-full bg-movenotes-primary text-primary-text py-2 rounded-lg transition-all hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Signup Code"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
            <p className="text-sm text-movenotes-muted text-center">
              Enter the 6-digit code we emailed to you.
            </p>
            <input
              type="text"
              placeholder="Enter code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full border border-movenotes-border bg-movenotes-bg text-movenotes-text rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-movenotes-primary"
            />
            <button
              onClick={handleVerifyOtp}
              disabled={loading}
              className="w-full bg-movenotes-primary text-primary-text py-2 rounded-lg transition-all hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify Code & Sign Up"}
            </button>
          </div>
        )}

        <p className="text-sm text-center text-movenotes-muted mt-6">
          Already have an account?{" "}
          <a
            href="/login"
            className="text-movenotes-accent underline hover:opacity-80"
          >
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}
