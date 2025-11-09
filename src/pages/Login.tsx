import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

export default function Login({ onLogin }: { onLogin?: (session: any) => void }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  // 1️⃣ Send OTP code to user's email
  const handleSendOtp = async () => {
    if (!isValidEmail(email)) {
      alert("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    setLoading(false);

    if (error) {
      console.error("[Login] Error sending OTP:", error.message);

      if (error.message.includes("Signups not allowed")) {
        alert("Email not found — redirecting to signup.");
        navigate("/signup", { state: { email } });
      } else {
        alert(error.message);
      }
    } else {
      setCodeSent(true);
    }
  };

  // 2️⃣ Verify the OTP entered by the user
  const handleVerifyOtp = async () => {
    console.log("[Login] Verifying OTP for:", email);
    setLoading(true);

    const { data: sessionData, error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    setLoading(false);

    if (error) {
      console.error("[Login] OTP verification error:", error);
      alert(error.message);
      return;
    }

    const session = sessionData.session;
    console.log("[Login] Logged in successfully:", session?.user?.email);
    onLogin?.(session);
    navigate("/");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-movenotes-bg text-movenotes-text">
      <div className="w-full max-w-md p-6 bg-movenotes-surface shadow-sm rounded-2xl">
        <h1 className="text-2xl font-semibold text-center text-movenotes-primary mb-6">
          Log In to MoveNotes
        </h1>

        {!codeSent ? (
          <>
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-movenotes-border bg-movenotes-bg text-movenotes-text rounded-lg p-2 mb-4 focus:outline-none focus:ring-2 focus:ring-movenotes-primary"
            />

            <button
              onClick={handleSendOtp}
              disabled={loading}
              className="w-full bg-movenotes-primary text-primary-text py-2 rounded-lg transition-all hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Login Code"}
            </button>

            {/* Not a member link */}
            <p className="mt-6 text-sm text-center text-movenotes-muted">
              Not a member?{" "}
              <a
                href="/signup"
                className="text-movenotes-accent underline hover:opacity-80"
              >
                Sign up here
              </a>
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
              Enter the 6-digit code sent to your email:
            </p>
            <input
              type="text"
              placeholder="Enter code"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full border border-movenotes-border bg-movenotes-bg text-movenotes-text rounded-lg p-2 mb-4 focus:outline-none focus:ring-2 focus:ring-movenotes-primary"
            />
            <button
              onClick={handleVerifyOtp}
              disabled={loading}
              className="w-full bg-movenotes-primary text-primary-text py-2 rounded-lg transition-all hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Verifying..." : "Verify Code"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
