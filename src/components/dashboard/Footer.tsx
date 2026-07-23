import { useEffect, useState } from "react";
import { loadCompany } from "../../services/company/companyService";
import { BRANDING_CHANGED_EVENT } from "../../services/branding/brandingService";
import type { Company } from "../../types/company";

function Footer() {
  const [company, setCompany] = useState<Company | null>(null);

  useEffect(() => {
    function refresh() {
      loadCompany().then(setCompany).catch(() => setCompany(null));
    }
    refresh();
    window.addEventListener(BRANDING_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(BRANDING_CHANGED_EVENT, refresh);
  }, []);

  if (!company) return null;

  const addressParts = [company.address, company.city, company.state, company.pincode]
    .map((p) => p?.trim())
    .filter(Boolean);

  return (
    <footer className="border-t border-slate-200 bg-white px-8 py-6 text-sm text-slate-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-slate-700">{company.company_name}</p>
          {addressParts.length > 0 && <p className="mt-0.5">{addressParts.join(", ")}</p>}
          {(company.email || company.phone) && (
            <p className="mt-0.5">
              {company.email && <span>{company.email}</span>}
              {company.email && company.phone && <span> · </span>}
              {company.phone && <span>{company.phone}</span>}
            </p>
          )}
        </div>
        <div className="text-left sm:text-right">
          <p>© {new Date().getFullYear()} {company.company_name}. All rights reserved.</p>
          {company.website && (
            <a href={company.website} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-block text-yellow-600 hover:underline">
              {company.website}
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}

export default Footer;
