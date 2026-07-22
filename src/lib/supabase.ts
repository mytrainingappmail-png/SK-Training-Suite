import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase environment variables are missing.");
}

// persistSession + autoRefreshToken are now ON. This is required for the
// new secure login: once an employee logs in, Supabase needs to remember
// their real session across page refreshes so every future request stays
// correctly scoped to their own company (RLS). Previously this was off
// because login never created a real Supabase session at all.
export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);