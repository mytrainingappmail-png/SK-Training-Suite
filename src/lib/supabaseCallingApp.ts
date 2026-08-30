import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase environment variables are missing.");
}

// Separate client, separate storageKey — same reasoning as
// supabaseQuiz.ts/supabaseAptitude.ts: the Calling App's dedicated-login
// mode opens its own session that must never clobber (or be clobbered
// by) an LMS employee session open in another tab on the same device.
// Someone using it through their normal LMS login instead never touches
// this client at all — that path reads through the main `supabase`
// client's own session.
export const supabaseCallingApp = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "sb-calling-app-auth-token",
  },
});
