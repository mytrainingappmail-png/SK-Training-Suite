import { useEffect, useState } from "react";
import type { Company } from "../../types/company";

import {
  loadCompany,
  saveCompany,
} from "../../services/company/companyService";

function CompanyManagement() {
  const [company, setCompany] = useState<Company | null>(null);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchCompany() {
      const data = await loadCompany();

      setCompany(data);

      setLoading(false);
    }

    fetchCompany();
  }, []);

  async function handleSave() {
    if (!company) return;

    setSaving(true);

    try {
      await saveCompany(company.id, company);

      alert("✅ Company Updated Successfully");
    } catch (error) {
      console.error(error);

      alert("❌ Failed to update company.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="animate-pulse text-slate-500">
          Loading Company Profile...
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-8">
        Company record not found.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">

      <div className="flex items-center justify-between mb-8">

        <div>

          <h2 className="text-2xl font-bold text-slate-800">
            Company Management
          </h2>

          <p className="text-slate-500">
            Configure your company profile and branding.
          </p>

        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-5 py-3 rounded-xl font-semibold transition ${
            saving
              ? "bg-slate-300 cursor-not-allowed"
              : "bg-yellow-500 hover:bg-yellow-400"
          }`}
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>

      </div>

      <div className="grid md:grid-cols-2 grid-cols-1 gap-6">

        <div>

          <label className="block text-sm font-medium mb-2">
            Company Name
          </label>

          <input
            className="w-full border rounded-xl p-3"
            value={company.company_name ?? ""}
            onChange={(e) =>
              setCompany({
                ...company,
                company_name: e.target.value,
              })
            }
          />

        </div>

        <div>

          <label className="block text-sm font-medium mb-2">
            Short Name
          </label>

          <input
            className="w-full border rounded-xl p-3"
            value={company.short_name ?? ""}
            onChange={(e) =>
              setCompany({
                ...company,
                short_name: e.target.value,
              })
            }
          />

        </div>

        <div>

          <label className="block text-sm font-medium mb-2">
            Website
          </label>

          <input
            className="w-full border rounded-xl p-3"
            value={company.website ?? ""}
            onChange={(e) =>
              setCompany({
                ...company,
                website: e.target.value,
              })
            }
          />

        </div>

        <div>

          <label className="block text-sm font-medium mb-2">
            Email
          </label>

          <input
            className="w-full border rounded-xl p-3"
            value={company.email ?? ""}
            onChange={(e) =>
              setCompany({
                ...company,
                email: e.target.value,
              })
            }
          />

        </div>

      </div>

    </div>
  );
}

export default CompanyManagement;