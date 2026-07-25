import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase environment variables are missing.");
}

// A THIRD separate client/storageKey, distinct from both the LMS's own
// client and supabaseQuiz (the quiz-ADMIN client). Without this, a
// trainer previewing the public Join page in another tab on their own
// device (same origin, same localStorage) would have their anonymous
// participant sign-in silently overwrite — and log them out of — their
// own quiz-admin session, since both would otherwise share one
// storageKey. Real trainees on their own separate devices would never
// have hit this, but a trainer testing/demoing locally would.
export const supabaseQuizPlayer = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: "sb-quiz-player-auth-token",
  },
});
