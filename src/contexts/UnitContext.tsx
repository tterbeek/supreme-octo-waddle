import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { supabase } from "../supabaseClient";
import type { UnitSystem } from "../lib/units";

type UnitContextValue = {
  unitSystem: UnitSystem;
  setUnitSystem: (unit: UnitSystem) => void;
};

export const UnitContext = createContext<UnitContextValue>({
  unitSystem: "metric",
  setUnitSystem: () => {},
});

export function UnitProvider({ children }: { children: ReactNode }) {
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");

  useEffect(() => {
    let cancelled = false;

    const loadPreference = async (userId: string) => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("unit_system")
        .eq("user_id", userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.warn("[UnitContext] Could not load unit preference:", error.message);
        return;
      }

      if (data?.unit_system === "imperial" || data?.unit_system === "metric") {
        setUnitSystem(data.unit_system);
      }
    };

    supabase.auth.getUser().then(({ data }) => {
      const userId = data?.user?.id;
      if (userId && !cancelled) {
        loadPreference(userId);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id;
      if (!userId) {
        setUnitSystem("metric");
        return;
      }
      loadPreference(userId);
    });

    return () => {
      cancelled = true;
      sub?.subscription.unsubscribe();
    };
  }, []);

  return (
    <UnitContext.Provider value={{ unitSystem, setUnitSystem }}>
      {children}
    </UnitContext.Provider>
  );
}

export function useUnitSystem() {
  return useContext(UnitContext);
}
