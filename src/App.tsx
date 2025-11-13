import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import PresetsPage from "./pages/PresetsPage";
import AddPresetPage from "./pages/AddPresetPage";
import EditPresetPage from "./pages/EditPresetPage";
import StatsPage from "./pages/StatsPage";
import GoalsPage from "./pages/GoalsPage";
import AnimatedLogo from "./components/AnimatedLogo";
import { motion, AnimatePresence } from "framer-motion";
import type { User } from "@supabase/supabase-js";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";


export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  // 🌅 Splash logic
  useEffect(() => {
    const today = new Date().toDateString();
    const lastSeen = localStorage.getItem("lastSeenLogoDate");
    const shouldShow = lastSeen !== today;

    console.log("[Splash] Today:", today, "| Last seen:", lastSeen);
    console.log("[Splash] Should show:", shouldShow || !lastSeen);

    // Mark as seen immediately
    localStorage.setItem("lastSeenLogoDate", today);

    setShowSplash(shouldShow || !lastSeen);

    if (shouldShow || !lastSeen) {
      console.log("[Splash] → Showing splash animation now");
    } else {
      console.log("[Splash] → Skipping splash (already seen today)");
    }

    const timer = setTimeout(() => {
      console.log("[Splash] Timer ended (2.5s) → Hiding splash");
      setShowSplash(false);
    }, 2500);

    return () => {
      console.log("[Splash] Cleaning up timer");
      clearTimeout(timer);
    };
  }, []);

  // 🔐 Supabase auth
  useEffect(() => {
    console.log("[Auth] Checking user session...");
    supabase.auth.getUser().then(({ data }) => {
      setUser(data?.user ?? null);
      setAuthReady(true);
      console.log("[Auth] getUser result:", data?.user ? "User found" : "No user");
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      console.log("[Auth] onAuthStateChange event:", _e);
      setUser(session?.user ?? null);
    });

    return () => {
      console.log("[Auth] Unsubscribing auth listener");
      sub?.subscription.unsubscribe();
    };
  }, []);

  console.log(
    `[Render] showSplash=${showSplash} | authReady=${authReady} | user=${user ? user.email : "none"}`
  );

  // 🚀 Always show splash for 2.5 s before anything else
  if (showSplash) {
    console.log("[Render] Rendering splash screen");
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-movenotes-bg">
        <AnimatedLogo />
      </div>
    );
  }

  if (!authReady) {
    console.log("[Render] Waiting for auth (blank screen)");
    return <div className="bg-movenotes-bg h-screen" />;
  }

  console.log("[Render] Rendering main app routes");

  return (
    <BrowserRouter>
      <AnimatePresence mode="wait">
        <motion.div
  key="content"
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: 0.4 }}
  className="
    mx-auto 
    w-full 
    max-w-md 
    sm:max-w-lg 
    md:max-w-2xl 
    lg:max-w-3xl 
    min-h-screen 
    p-4 
    bg-movenotes-bg 
    text-movenotes-text
  "
>

<Routes>
  {/* 🌿 Public routes (always visible) */}
  <Route path="/terms" element={<Terms />} />
  <Route path="/privacy" element={<Privacy />} />

  {/* 🔐 Auth routes */}
  {!user ? (
    <>
      <Route path="/" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
    </>
  ) : (
    <>
      <Route path="/" element={<Home />} />
      <Route path="/presets" element={<PresetsPage />} />
      <Route path="/presets/new" element={<AddPresetPage />} />
      <Route path="/presets/:id" element={<EditPresetPage />} />
      <Route path="/stats" element={<StatsPage />} />
      <Route path="/goals" element={<GoalsPage />} />
    </>
  )}
</Routes>

        </motion.div>
      </AnimatePresence>
    </BrowserRouter>
  );
}
