import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { isOwnerAccount } from "../../supabase/functions/_shared/accountAccess";

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkUser() {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return setAllowed(false);
      if (isOwnerAccount(data.user)) return setAllowed(true);
      return setAllowed(false);
    }
    checkUser();
  }, []);

  if (allowed === null) return <div className="p-4">Checking access…</div>;
  if (!allowed) return <Navigate to="/" replace />;

  return <>{children}</>;
}
