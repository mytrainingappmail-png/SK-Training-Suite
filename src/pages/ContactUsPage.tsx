// A genuinely public page — no login required. Shows the platform
// operator's own business contact details (for payment-gateway/compliance
// purposes), not any individual subscribing company's info.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { loadOperatorContact } from "../services/branding/operatorContactService";
import { ROUTES } from "../constants/routes";
import type { PublicOperatorContact } from "../repositories/branding/operatorContactRepository";

function ContactUsPage() {
  const navigate = useNavigate();
  const [contact, setContact] = useState<PublicOperatorContact | null>(null);
  const [loading, setLoading] = useState(true);

  function goBack() {
    if (window.history.length > 1) navigate(-1);
    else navigate(ROUTES.LOGIN);
  }

  useEffect(() => {
    loadOperatorContact()
      .then(setContact)
      .finally(() => setLoading(false));
  }, []);

  const addressParts = contact
    ? [contact.address, contact.city, contact.state, contact.pincode, contact.country].map((p) => p?.trim()).filter(Boolean)
    : [];

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <button onClick={goBack} className="mb-6 inline-block text-sm font-semibold text-indigo-600 hover:underline">
          ← Back
        </button>

        {loading && <div className="h-64 animate-pulse rounded-2xl bg-white shadow-sm" />}

        {!loading && !contact && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-600">
            Contact details are not available right now.
          </div>
        )}

        {!loading && contact && (
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <h1 className="mb-1 text-2xl font-bold text-slate-900">Contact Us</h1>
            <p className="mb-6 text-sm text-slate-500">{contact.legal_name || contact.company_name}</p>

            <dl className="space-y-4 text-sm">
              {addressParts.length > 0 && (
                <div>
                  <dt className="font-semibold text-slate-700">Registered Address</dt>
                  <dd className="mt-0.5 text-slate-600">{addressParts.join(", ")}</dd>
                </div>
              )}
              {contact.email && (
                <div>
                  <dt className="font-semibold text-slate-700">Email</dt>
                  <dd className="mt-0.5">
                    <a href={`mailto:${contact.email}`} className="text-indigo-600 hover:underline">
                      {contact.email}
                    </a>
                  </dd>
                </div>
              )}
              {contact.phone && (
                <div>
                  <dt className="font-semibold text-slate-700">Phone</dt>
                  <dd className="mt-0.5">
                    <a href={`tel:${contact.phone}`} className="text-indigo-600 hover:underline">
                      {contact.phone}
                    </a>
                  </dd>
                </div>
              )}
              {contact.website && (
                <div>
                  <dt className="font-semibold text-slate-700">Website</dt>
                  <dd className="mt-0.5">
                    <a href={contact.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                      {contact.website}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>
    </div>
  );
}

export default ContactUsPage;
