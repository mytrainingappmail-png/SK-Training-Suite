import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://psxbxbbspkteiczojajh.supabase.co";

const supabaseKey =
  "sb_publishable_POE54ZZf2nnItnzprWjZnA_zQaKAaI_";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

console.log("SUPABASE URL:", supabaseUrl);
console.log("SUPABASE KEY:", supabaseKey);