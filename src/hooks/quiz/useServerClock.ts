import { useEffect, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { measureClockOffset } from "../../lib/serverClock";

/**
 * Keeps a running correction between this device's clock and the database's, so
 * countdowns are computed from DATABASE time. A phone or laptop whose clock is a
 * few seconds fast used to start every question with that many seconds already
 * gone (or, for the host, end every question early for everybody).
 *
 * Returns a function: serverNow() -> the database's current time in ms. It is
 * stable across renders and always uses the latest measurement. Measured three
 * times at start (keeping the sample with the shortest round trip, which is the
 * most accurate) and again every minute.
 */
export function useServerClock(client: SupabaseClient): () => number {
  const offsetRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    async function measure() {
      const samples: number[] = [];
      for (let i = 0; i < 3; i++) {
        const before = Date.now();
        const offset = await measureClockOffset(client);
        const rtt = Date.now() - before;
        samples.push(offset);
        if (rtt < 150) break; // already a precise sample
      }
      if (cancelled || samples.length === 0) return;
      // Median is robust against one slow round trip.
      samples.sort((a, b) => a - b);
      offsetRef.current = samples[Math.floor(samples.length / 2)];
    }

    void measure();
    const t = setInterval(() => { void measure(); }, 60000);
    return () => { cancelled = true; clearInterval(t); };
  }, [client]);

  return useRef(() => Date.now() + offsetRef.current).current;
}
