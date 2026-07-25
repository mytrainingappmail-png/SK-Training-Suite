import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase environment variables are missing.");
}

// Separate client instance, separate storageKey, from src/lib/supabase.ts.
// The Live Quiz module opens in its own browser TAB (same origin as the
// LMS), so localStorage is shared across tabs — without a distinct
// storageKey, a quiz-admin login here would silently clobber (or be
// clobbered by) an LMS employee session open in another tab, since the
// Supabase JS client persists exactly one session per storage key. This
// keeps quiz-admin/participant auth genuinely independent of LMS auth
// even when both are open at once on the same device.
export const supabaseQuiz = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "sb-quiz-training-auth-token",
  },
});
