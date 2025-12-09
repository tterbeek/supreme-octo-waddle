import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const ADMIN_ID = "589c83df-8ee7-4319-9203-5b5c9aae0d07";

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkUser() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return setAllowed(false);
      if (data.user.id === ADMIN_ID) return setAllowed(true);
      return setAllowed(false);
    }
    checkUser();
  }, []);

  if (allowed === null) return <div className="p-4">Checking access…</div>;
  if (!allowed) return <Navigate to="/" replace />;

  return <>{children}</>;
}
