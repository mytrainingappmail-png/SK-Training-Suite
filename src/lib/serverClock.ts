// Browser clock -> database clock correction, for countdowns.
//
// Deadlines are stamped by the database (now() inside an RPC). Comparing
// them against a phone/laptop's own Date.now() breaks whenever that clock
// is wrong — a countdown that ends instantly, or minutes late. So measure
// how far this device is from the database once (half the round trip is
// treated as the one-way delay) and add that offset wherever "now" is
// needed.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Milliseconds to ADD to Date.now() to get the database's current time. */
export async function measureClockOffset(client: SupabaseClient): Promise<number> {
  const before = Date.now();
  const { data, error } = await client.rpc("server_now");
  const after = Date.now();
  if (error || !data) return 0;
  const serverMs = new Date(data as string).getTime();
  if (Number.isNaN(serverMs)) return 0;
  return serverMs - (before + after) / 2;
}
