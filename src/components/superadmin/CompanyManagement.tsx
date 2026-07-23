import { useEffect, useRef, useState } from "react";
import type { Company } from "../../types/company";

import {
  loadCompany,
  saveCompany,
} from "../../services/company/companyService";
import { uploadImage } from "../../services/contentEditor/contentEditorService";
import { invalidateBrandingCache } from "../../services/branding/brandingService";

type ImageFieldKey = "logo" | "login_logo_url" | "app_icon_url";

function ImageUploadField({
  label,
  hint,
  value,
  uploading,
  onUpload,
}: {
  label: string;
  hint: string;
  value: string;
  uploading: boolean;
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <p className="mb-2 text-xs text-slate-400">{hint}</p>
      <div className="flex items-center gap-4">
        {value ? (
          <img src={value} alt={label} className="h-16 w-16 rounded-xl border object-contain bg-white p-1" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed text-slate-300 text-xs text-center">
            None set
          </div>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {uploading ? "Uploading…" : value ? "Replace Image" : "Upload Image"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp,.gif,.svg"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onUpload(f);
          }}
        />
      </div>
    </div>
  );
}

function CompanyManagement() {
  const [company, setCompany] = useState<Company | null>(null);

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<ImageFieldKey | null>(null);

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

  // Images save immediately on upload — waiting for a separate "Save
  // Changes" click after picking a file is a common source of "I uploaded
  // it, why didn't it change?" confusion.
  async function handleImageUpload(field: ImageFieldKey, file: File) {
    if (!company) return;
    setUploadingField(field);
    try {
      const { url } = await uploadImage(file);
      const updated = { ...company, [field]: url };
      await saveCompany(company.id, updated);
      setCompany(updated);
      invalidateBrandingCache();
    } catch (error) {
      console.error(error);
      alert("❌ Failed to upload image.");
    } finally {
      setUploadingField(null);
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

      <div className="mt-8 border-t pt-6">
        <h3 className="mb-1 text-base font-bold text-slate-800">Branding</h3>
        <p className="mb-5 text-sm text-slate-500">
          These update everywhere in the app immediately after upload — no code change or redeploy needed.
        </p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <ImageUploadField
            label="Company Logo"
            hint="Shown in the sidebar and header."
            value={company.logo}
            uploading={uploadingField === "logo"}
            onUpload={(f) => handleImageUpload("logo", f)}
          />
          <ImageUploadField
            label="Login Page Image"
            hint="Shown on the login screen's dark panel."
            value={company.login_logo_url}
            uploading={uploadingField === "login_logo_url"}
            onUpload={(f) => handleImageUpload("login_logo_url", f)}
          />
          <ImageUploadField
            label="App Icon"
            hint="Browser tab icon and install/home-screen icon."
            value={company.app_icon_url}
            uploading={uploadingField === "app_icon_url"}
            onUpload={(f) => handleImageUpload("app_icon_url", f)}
          />
        </div>
      </div>

    </div>
  );
}

export default CompanyManagement;