import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import { supabase } from "./supabaseClient";
import { useEffect, useState } from "react";
import PresetsPage from "./pages/PresetsPage";
import AddPresetPage from "./pages/AddPresetPage";
import EditPresetPage from "./pages/EditPresetPage";


export default function App() {
const [user, setUser] = useState<any>(null);

useEffect(() => {
  supabase.auth.getUser().then(({ data }) => setUser(data.user));
  supabase.auth.onAuthStateChange((_event, session) => {
    setUser(session?.user ?? null);
  });
}, []);


if (!user) return <Login />;
  return (
    <BrowserRouter>
      <div className="mx-auto max-w-md min-h-screen p-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/presets" element={<PresetsPage />} />
          <Route path="/presets/new" element={<AddPresetPage />} />
          <Route path="/presets/:id" element={<EditPresetPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
