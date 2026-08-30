// Entry point for someone using the Calling App through their EXISTING
// LMS login (no separate password) — mounted inside AppLayout like any
// other LMS page, gated by ProtectedRoute. Renders the exact same
// CallingAppShell as the standalone dedicated-login route, just with the
// main `supabase` client instead of supabaseCallingApp.

import { useEffect, useState } from "react";

import { supabase } from "../../lib/supabase";
import { getMyEmployeeLinkedGrant } from "../../repositories/callingApp/callingAppAdminRepository";
import { CallingAppShell } from "../../modules/callingApp/CallingAppShell";
import type { CallingAppAdmin } from "../../types/callingApp";

type State = "checking" | "no-access" | "module-disabled" | "ok";

export default function CallingAppEmbeddedPage() {
  const [state, setState] = useState<State>("checking");
  const [admin, setAdmin] = useState<CallingAppAdmin | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const grant = await getMyEmployeeLinkedGrant();
      if (cancelled) return;
      if (!grant) {
        setState("no-access");
        return;
      }

      const { data: enabled } = await supabase.rpc("current_company_module_enabled", {
        p_company_id: grant.company_id,
        p_module_key: "calling_app",
      });
      if (cancelled) return;

      if (!enabled) {
        setState("module-disabled");
        return;
      }

      setAdmin(grant);
      setState("ok");
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "checking") {
    return <div className="flex h-40 items-center justify-center text-sm text-slate-400">Loading…</div>;
  }

  if (state === "no-access") {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
        <div className="text-3xl">🔒</div>
        <p className="mt-2 text-sm font-semibold text-slate-700">You don't have Calling App access.</p>
        <p className="mt-1 text-xs text-slate-500">Ask your Super Admin to grant it from Admin → Calling App.</p>
      </div>
    );
  }

  if (state === "module-disabled") {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
        <div className="text-3xl">🔒</div>
        <p className="mt-2 text-sm font-semibold text-slate-700">Calling App is not enabled for your company.</p>
      </div>
    );
  }

  if (!admin) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">📞 Calling App</h1>
      <CallingAppShell identity={{ admin, client: supabase }} />
    </div>
  );
}
