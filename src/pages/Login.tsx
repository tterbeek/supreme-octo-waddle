import FormPage from "../components/forms/FormPage";
import { FormActions } from "../components/forms/FormLayout";
import { allowFormNavigation } from "../lib/formLifecycle";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import PublicTopNav from "../components/PublicTopNav";
import HeaderLogo from "../components/HeaderLogo";

export default function Login({ onLogin }: { onLogin?: (session: any) => void }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const nextParam = new URLSearchParams(location.search).get("next");
  const redirectTo = nextParam && nextParam.startsWith("/") ? nextParam : "/";
  const signupHref =
    redirectTo === "/"
      ? "/signup"
      : `/signup?next=${encodeURIComponent(redirectTo)}`;

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // 1️⃣ Send OTP code to user's email
  const handleSendOtp = async () => {
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setLoading(false);

    if (error) {
      console.error("[Login] Error sending OTP:", error.message);

      if (error.message.includes("Signups not allowed")) {
        setError("Email not found — redirecting to signup.");
        navigate(signupHref, { state: { email } });
      } else {
        setError(error.message);
      }
    } else {
      setCodeSent(true);
    }
  };

  // 2️⃣ Verify the OTP entered by the user
  const handleVerifyOtp = async () => {
    console.log("[Login] Verifying OTP for:", email);
    setError(null);
    setLoading(true);

    const { data: sessionData, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    setLoading(false);

    if (error) {
      console.error("[Login] OTP verification error:", error);
      setError(error.message);
      return;
    }

    const session = sessionData.session;
    console.log("[Login] Logged in successfully:", session?.user?.email);
    onLogin?.(session);
    allowFormNavigation(() => navigate(redirectTo));
  };

  return (
    <div className="flex flex-col items-center justify-start pt-24 pb-12 min-h-dvh bg-movenotes-bg text-movenotes-text relative">
      <PublicTopNav />
      <div className="mb-6 flex justify-center">
        <HeaderLogo withTagline />
      </div>
      <FormPage title="Log in" backTo="/" dirty={Boolean(email || otp)} busy={loading}>
        {error && <p role="alert" className="mn-error">{error}</p>}



        {!codeSent ? (
          <>
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              aria-label="Email address"
              autoComplete="email"
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-movenotes-border bg-movenotes-bg text-movenotes-text rounded-lg p-2 mb-4 focus:outline-none focus:ring-2 focus:ring-movenotes-primary"
            />

            <FormActions><button
              onClick={handleSendOtp}
              disabled={loading}
              className="w-full bg-movenotes-primary text-primary-text py-2 rounded-lg transition-all hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Login Code"}
            </button></FormActions>

            {/* Not a member link */}
            <p className="mt-6 text-sm text-center text-movenotes-muted">
              Not a member?{" "}
              <Link
                to={signupHref}
                className="text-movenotes-accent underline hover:opacity-80"
              >
                Sign up here
              </Link>
            </p>

            {/* Privacy & Terms links */}
            <p className="text-sm text-center text-movenotes-muted mt-4">
              By logging in, you agree to our{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-movenotes-accent underline hover:opacity-80"
              >
                Terms of Use
              </a>{" "}
              and{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-movenotes-accent underline hover:opacity-80"
              >
                Privacy Policy
              </a>
              .
            </p>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm text-movenotes-muted text-center">
              Enter the 8-digit code sent to your email:
            </p>
            <label htmlFor="login-code">Email verification code</label>
            <input
              id="login-code"
              aria-label="Email verification code"
              inputMode="numeric"
              autoComplete="one-time-code"
              type="text"
              placeholder="Enter code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full border border-movenotes-border bg-movenotes-bg text-movenotes-text rounded-lg p-2 mb-4 focus:outline-none focus:ring-2 focus:ring-movenotes-primary"
            />
            <FormActions><button
              onClick={handleVerifyOtp}
              disabled={loading}
              className="w-full bg-movenotes-primary text-primary-text py-2 rounded-lg transition-all hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify Code"}
            </button></FormActions>
          </>
        )}
      </FormPage>
    </div>
  );
}
