import FormPage from "../components/forms/FormPage";
import { FormActions } from "../components/forms/FormLayout";
import { allowFormNavigation } from "../lib/formLifecycle";
// src/pages/Signup.tsx
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";
import PublicTopNav from "../components/PublicTopNav";
import HeaderLogo from "../components/HeaderLogo";

interface SignupProps {
  onSignup?: (session: any) => void;
}

export default function Signup({ onSignup }: SignupProps) {
  const location = useLocation();
  const prefilledEmail = (location.state as { email?: string } | null)?.email || "";
  const nextParam = new URLSearchParams(location.search).get("next");
  const redirectTo = nextParam && nextParam.startsWith("/") ? nextParam : "/";
  const loginHref =
    redirectTo === "/"
      ? "/login"
      : `/login?next=${encodeURIComponent(redirectTo)}`;
  const [email, setEmail] = useState(prefilledEmail);
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [consentTerms, setConsentTerms] = useState(false);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const navigate = useNavigate();

  const isValidEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  // 1️⃣ Request OTP for signup
  const handleSendOtp = async () => {
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!consentPrivacy || !consentTerms) {
      setError("You must accept the Privacy Policy and Terms of Use.");
      return;
    }

    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setLoading(false);

    if (error) {
      console.error("[Signup] Error sending OTP:", error);
      setError(error.message);
    } else {
      setCodeSent(true);
    }
  };

  // 2️⃣ Verify OTP and log in the user
  const handleVerifyOtp = async () => {
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });
    setLoading(false);

    if (error) {
      console.error("[Signup] OTP verification error:", error);
      setError(error.message);
      return;
    }

    const session = data?.session;
    const user = session?.user ?? data?.user ?? null;

    if (!session || !user) {
      console.error("[Signup] No active session returned after OTP verification.");
      setError("We couldn't complete the signup. Please try again.");
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
            newsletter_opt_in: newsletterOptIn,
          },
        ]);

      if (consentError) {
        console.error("[Signup] Error saving consent:", consentError.message);
      }
    } catch (err) {
      console.error("[Signup] Unexpected error saving consent:", err);
    }

    // ✅ Redirect to main app
    allowFormNavigation(() => navigate(redirectTo));
  };

  return (
    <div className="flex flex-col items-center justify-start pt-24 pb-12 min-h-dvh bg-movenotes-bg text-movenotes-text relative">
      <PublicTopNav />
      <div className="mb-6 flex justify-center">
        <HeaderLogo />
      </div>
      <FormPage title="Create account" backTo="/" dirty={email !== prefilledEmail || Boolean(otp || consentPrivacy || consentTerms || newsletterOptIn)} busy={loading}>

        {error && <p role="alert" className="mn-error">{error}</p>}


        {!codeSent ? (
          <div className="flex flex-col space-y-4">
            <label htmlFor="signup-email">Email address</label>
            <input
              id="signup-email"
              aria-label="Email address"
              autoComplete="email"
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

            <div className="flex items-start space-x-2 text-sm">
              <input
                type="checkbox"
                id="newsletter"
                checked={newsletterOptIn}
                onChange={(e) => setNewsletterOptIn(e.target.checked)}
                className="mt-1"
              />
              <label htmlFor="newsletter">
                Send me occasional updates & movement inspiration (optional)
              </label>
            </div>

            <FormActions><button
              onClick={handleSendOtp}
              disabled={loading}
              className="w-full bg-movenotes-primary text-primary-text py-2 rounded-lg transition-all hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Signup Code"}
            </button></FormActions>
          </div>
        ) : (
          <div className="flex flex-col space-y-4">
            <p className="text-sm text-movenotes-muted text-center">
              Enter the 8-digit code we emailed to you.
            </p>
            <label htmlFor="signup-code">Email verification code</label>
            <input
              id="signup-code"
              aria-label="Email verification code"
              inputMode="numeric"
              autoComplete="one-time-code"
              type="text"
              placeholder="Enter code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full border border-movenotes-border bg-movenotes-bg text-movenotes-text rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-movenotes-primary"
            />
            <FormActions><button
              onClick={handleVerifyOtp}
              disabled={loading}
              className="w-full bg-movenotes-primary text-primary-text py-2 rounded-lg transition-all hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify Code & Sign Up"}
            </button></FormActions>
          </div>
        )}

        <p className="text-sm text-center text-movenotes-muted mt-6">
          Already have an account?{" "}
          <Link
            to={loginHref}
            className="text-movenotes-accent underline hover:opacity-80"
          >
            Log in
          </Link>
        </p>
      </FormPage>
    </div>
  );
}
