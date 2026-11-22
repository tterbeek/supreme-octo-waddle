import fs from "node:fs";
import { parse } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { delay } from "./webview-driver.mjs";
export async function localSession() {
  const env = parse(
    fs.readFileSync(new URL("../../.env.development.local", import.meta.url)),
  );
  const url = env.VITE_SUPABASE_URL;
  if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
    throw Error("Refusing hosted auth test");
  const client = createClient(url, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `capacitor-android-${Date.now()}@example.invalid`;
  let r = await client.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (r.error) throw Error("Local test signup failed");
  let tokenHash;
  for (let i = 0; i < 30; i++) {
    const list = await (
      await fetch("http://127.0.0.1:54324/api/v1/messages")
    ).json();
    const match = list.messages.find((m) =>
      m.To?.some((t) => t.Address === email),
    );
    if (match) {
      const message = await (
        await fetch("http://127.0.0.1:54324/api/v1/message/" + match.ID)
      ).json();
      tokenHash = (message.Text || message.HTML).match(
        /(?:token|token_hash)=([a-f0-9]+)/,
      )?.[1];
      if (tokenHash) break;
    }
    await delay(300);
  }
  if (!tokenHash) throw Error("Local confirmation mail unavailable");
  r = await client.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  if (r.error) throw Error("Local mail verification failed");
  return { client, session: r.data.session, user: r.data.user };
}
