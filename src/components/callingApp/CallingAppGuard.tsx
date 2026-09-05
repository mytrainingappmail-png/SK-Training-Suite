import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { supabaseCallingApp } from "../../lib/supabaseCallingApp";
import { ROUTES } from "../../constants/routes";
import { loadCurrentCallingAppAdmin, clearCurrentCallingAppAdmin } from "../../services/callingApp/callingAppAuthService";

type GuardState = "checking" | "ok" | "no-session" | "module-disabled";

/** Gate for every /calling-app/* route (dedicated-login mode only —
 * the embedded /calling-app-lms route has its own, simpler check). */
export default function CallingAppGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GuardState>("checking");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const cachedAdmin = loadCurrentCallingAppAdmin();
      const { data } = await supabaseCallingApp.auth.getSession();

      if (!cachedAdmin || !data.session) {
        clearCurrentCallingAppAdmin();
        if (!cancelled) setState("no-session");
        return;
      }

      const { data: enabled, error } = await supabaseCallingApp.rpc("current_company_module_enabled", {
        p_company_id: cachedAdmin.company_id,
        p_module_key: "calling_app",
      });
      if (cancelled) return;

      if (error) {
        clearCurrentCallingAppAdmin();
        setState("no-session");
        return;
      }

      setState(enabled ? "ok" : "module-disabled");
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
      </div>
    );
  }

  if (state === "no-session") {
    return <Navigate to={ROUTES.CALLING_APP_LOGIN} replace />;
  }

  if (state === "module-disabled") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-200">
        <div className="max-w-md space-y-3 text-center">
          <div className="text-3xl">🔒</div>
          <h1 className="text-lg font-semibold">Calling App is not enabled</h1>
          <p className="text-sm text-slate-600">This company's access to the Calling App has been turned off. Contact your administrator.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
