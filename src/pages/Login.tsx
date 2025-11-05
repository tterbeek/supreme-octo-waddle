import { useState } from "react";
import { supabase } from "../supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [step, setStep] = useState<"email" | "verify">("email");

  const sendCode = async () => {
    await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });
    setStep("verify");
  };

  const verifyCode = async () => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    if (!error) {
      // logged in → UI will auto update from App.tsx auth listener
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-20 p-4">
      <h1 className="text-xl font-bold mb-6 text-center">Log In</h1>

      {step === "email" && (
        <>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="border rounded w-full px-3 py-2 mb-3"
          />

          <button
            onClick={sendCode}
            className="bg-blue-600 text-white w-full py-3 rounded font-semibold"
          >
            Send Code
          </button>
        </>
      )}

      {step === "verify" && (
        <>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter 6-digit code"
            className="border rounded w-full px-3 py-2 mb-3 text-center tracking-widest text-lg"
          />

          <button
            onClick={verifyCode}
            className="bg-blue-600 text-white w-full py-3 rounded font-semibold"
          >
            Verify & Sign In
          </button>
        </>
      )}
    </div>
  );
}
