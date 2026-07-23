import { useEffect, useState } from "react";
import SettingsManagement from "../components/settings/SettingsManagement";
import { loadCompany } from "../services/company/companyService";

function Settings() {
  // Settings is genuinely platform-wide config (see
  // 20260722130000_platform_operator_scoping.sql) — writable only by the
  // platform-operator company. This route is reachable directly via the
  // top-level sidebar link (separate from the Admin page's own tab, which
  // already has this same gate), so it needs its own check too.
  const [loading, setLoading] = useState(true);
  const [isPlatformOperator, setIsPlatformOperator] = useState(false);

  useEffect(() => {
    loadCompany()
      .then((c) => setIsPlatformOperator(c?.is_platform_operator ?? false))
      .catch(() => setIsPlatformOperator(false))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  if (!isPlatformOperator) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <h2 className="mb-2 text-lg font-semibold text-slate-800">Platform Settings</h2>
        <p className="text-sm text-slate-500">
          These are global platform configuration values, managed by your platform provider.
          They apply the same way across every company and aren't editable here.
        </p>
      </div>
    );
  }

  return <SettingsManagement />;
}

export default Settings;
