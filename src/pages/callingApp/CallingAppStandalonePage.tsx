import { useNavigate } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { supabaseCallingApp } from "../../lib/supabaseCallingApp";
import { logout, getCurrentCallingAppAdmin } from "../../services/callingApp/callingAppAuthService";
import { CallingAppShell } from "../../modules/callingApp/CallingAppShell";

/** The dedicated-login entry point — /calling-app/dashboard etc, wrapped
 * in CallingAppGuard by App.tsx. Uses the supabaseCallingApp client. */
export default function CallingAppStandalonePage() {
  const navigate = useNavigate();
  const admin = getCurrentCallingAppAdmin();

  async function handleLogout() {
    await logout();
    navigate(ROUTES.CALLING_APP_LOGIN, { replace: true });
  }

  if (!admin) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">📞</span>
          <span className="font-semibold tracking-wide text-slate-900">Calling App</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-slate-500 sm:block">{admin.display_name}</span>
          <button onClick={handleLogout} className="text-sm font-semibold text-red-500 hover:text-red-600">Logout</button>
        </div>
      </nav>

      <main className="mx-auto px-6 py-6">
        <CallingAppShell identity={{ admin, client: supabaseCallingApp }} />
      </main>
    </div>
  );
}
