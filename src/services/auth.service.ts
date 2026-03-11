import { supabase } from "../supabaseClient";

export async function getCurrentUser() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user) {
    return sessionData.session.user;
  }
  const { data } = await supabase.auth.getUser();
  return data.user;
}
