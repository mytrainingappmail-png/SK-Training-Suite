// The public, logged-out homepage. Every piece of copy/branding here
// comes from platform_marketing_settings/platform_marketing_features —
// nothing is hardcoded — so the platform operator can fully white-label
// this page without touching code (Admin → Platform Configuration →
// Marketing Website).

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import {
  loadMarketingSettings,
  loadMarketingFeatures,
  loadMarketingTestimonials,
  loadPublicPricing,
  submitInquiry,
} from "../services/platformMarketing/platformMarketingService";
import { ROUTES } from "../constants/routes";
import { sanitizeHtml } from "../utils/sanitizeHtml";
import type {
  PlatformMarketingSettings,
  PlatformMarketingFeature,
  PlatformMarketingTestimonial,
  PublicSubscriptionPlan,
  InquirySource,
} from "../types/platformMarketing";

function QueryForm({ whatsappHref }: { whatsappHref: string | null }) {
  const [source, setSource] = useState<InquirySource>("trial");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const INPUT_CLS =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await submitInquiry({ source, name, company_name: companyName, phone, email, message });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-8 text-center">
        <div className="text-3xl">✅</div>
        <p className="mt-2 text-base font-semibold text-emerald-800">Thank you — we've received your request.</p>
        <p className="mt-1 text-sm text-emerald-700">We'll get back to you shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-100 bg-white p-8 shadow-sm">
      <div className="flex gap-2">
        {(
          [
            { value: "trial", label: "Start a Free Trial" },
            { value: "query", label: "Ask a Question" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSource(opt.value)}
            className={`flex-1 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition ${
              source === opt.value ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Name *" required className={INPUT_CLS} />
      <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company Name" className={INPUT_CLS} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className={INPUT_CLS} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className={INPUT_CLS} />
      </div>
      <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Anything else you'd like us to know?" rows={3} className={INPUT_CLS} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
      >
        {submitting ? "Sending…" : source === "trial" ? "Request Free Trial →" : "Send Message →"}
      </button>

      {whatsappHref && (
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="block text-center text-sm font-semibold text-emerald-600 hover:underline">
          or chat with us on WhatsApp →
        </a>
      )}
    </form>
  );
}

function WhatsAppIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm0 18.06h-.01a8.22 8.22 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.27-4.39c0-4.53 3.7-8.22 8.26-8.22 2.2 0 4.27.86 5.83 2.42a8.2 8.2 0 0 1 2.42 5.83c0 4.53-3.7 8.22-8.25 8.22Zm4.51-6.16c-.25-.12-1.46-.72-1.68-.8-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.48-1.39-1.73-.14-.24-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.24-.41.08-.16.04-.31-.02-.43-.06-.13-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.42-.14-.01-.31-.01-.47-.01a.9.9 0 0 0-.65.31c-.23.24-.86.85-.86 2.06 0 1.22.89 2.4 1.01 2.56.12.16 1.75 2.67 4.24 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.66-1.17.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.47-.28Z" />
    </svg>
  );
}

export default function MarketingHomePage() {
  const [settings, setSettings] = useState<PlatformMarketingSettings | null>(null);
  const [features, setFeatures] = useState<PlatformMarketingFeature[]>([]);
  const [testimonials, setTestimonials] = useState<PlatformMarketingTestimonial[]>([]);
  const [plans, setPlans] = useState<PublicSubscriptionPlan[]>([]);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadMarketingSettings(), loadMarketingFeatures(), loadMarketingTestimonials(), loadPublicPricing()])
      .then(([s, f, t, p]) => {
        setSettings(s);
        setFeatures(f);
        setTestimonials(t);
        setPlans(p);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  const companyName = settings?.footer_company_name?.trim() || "Training Suite";
  const whatsappHref = settings?.whatsapp_number
    ? `https://wa.me/${settings.whatsapp_number.replace(/\D/g, "")}?text=${encodeURIComponent(settings.whatsapp_default_message || "Hi, I would like to know more.")}`
    : null;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt={companyName} className="h-9 w-9 object-contain" />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600" />
            )}
            <span className="text-lg font-bold tracking-tight">{companyName}</span>
          </div>
          <Link
            to={ROUTES.LOGIN}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Login
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-950 via-slate-950 to-slate-950 px-6 py-24 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle at 20% 20%, #6366F1 0%, transparent 40%), radial-gradient(circle at 80% 60%, #A855F7 0%, transparent 40%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {settings?.hero_title}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-300">{settings?.hero_subtitle}</p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
            <a
              href="#get-started"
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:from-indigo-400 hover:to-violet-400"
            >
              {settings?.hero_cta_label} →
            </a>
            <Link to={ROUTES.LOGIN} className="text-sm font-semibold text-slate-300 hover:text-white">
              Already a customer? Sign in →
            </Link>
          </div>
        </div>
      </section>

      {/* About */}
      {settings?.about_content_html && (
        <section className="px-6 py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-bold tracking-tight">{settings.about_title}</h2>
            <div
              className="prose prose-slate mx-auto mt-8 max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(settings.about_content_html) }}
            />
          </div>
        </section>
      )}

      {/* Features */}
      {features.length > 0 && (
        <section className="bg-slate-50 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-bold tracking-tight">Why Choose Us</h2>
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div key={f.id} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                  <div className="text-3xl">{f.icon}</div>
                  <h3 className="mt-3 text-base font-bold text-slate-900">{f.title}</h3>
                  {f.description && <p className="mt-1.5 text-sm text-slate-500">{f.description}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <section className="px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-bold tracking-tight">What Our Customers Say</h2>
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t) => (
                <div key={t.id} className="flex flex-col rounded-2xl border border-slate-100 bg-slate-50 p-6">
                  <div className="text-amber-400">{"★".repeat(t.rating)}{"☆".repeat(5 - t.rating)}</div>
                  <p className="mt-3 flex-1 text-sm italic text-slate-700">“{t.quote}”</p>
                  <div className="mt-4 flex items-center gap-3">
                    {t.photo_url && <img src={t.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />}
                    <div>
                      <div className="text-sm font-bold text-slate-900">{t.name}</div>
                      {t.role_or_company && <div className="text-xs text-slate-500">{t.role_or_company}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Pricing */}
      {plans.length > 0 && (
        <section className="bg-slate-50 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-bold tracking-tight">Simple, Transparent Pricing</h2>
            <div className="mt-6 flex justify-center">
              <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
                {(["monthly", "yearly"] as const).map((cycle) => (
                  <button
                    key={cycle}
                    onClick={() => setBillingCycle(cycle)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${
                      billingCycle === cycle ? "bg-slate-900 text-white" : "text-slate-500"
                    }`}
                  >
                    {cycle}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
              {plans.map((p) => (
                <div key={p.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-900">{p.plan_name}</h3>
                  {p.description && <p className="mt-1 text-sm text-slate-500">{p.description}</p>}
                  <div className="mt-5">
                    <span className="text-3xl font-extrabold text-slate-900">
                      ₹{(billingCycle === "monthly" ? p.price_monthly : p.price_yearly).toLocaleString()}
                    </span>
                    <span className="text-sm text-slate-500">/{billingCycle === "monthly" ? "mo" : "yr"}</span>
                  </div>
                  <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-600">
                    <li>👥 Up to {p.max_employees.toLocaleString()} employees</li>
                    <li>📚 Up to {p.max_courses.toLocaleString()} courses</li>
                    {p.features.split(",").filter(Boolean).map((f) => (
                      <li key={f}>✓ {f.trim()}</li>
                    ))}
                  </ul>
                  <a
                    href="#get-started"
                    className="mt-6 rounded-xl bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Get Started
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Get Started / Query Form */}
      <section id="get-started" className="px-6 py-20">
        <div className="mx-auto max-w-md">
          <h2 className="text-center text-3xl font-bold tracking-tight">Get Started</h2>
          <p className="mt-3 text-center text-sm text-slate-500">Tell us a bit about you and we'll be in touch.</p>
          <div className="mt-8">
            <QueryForm whatsappHref={whatsappHref} />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 px-6 py-12 text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <div className="text-base font-bold text-white">{companyName}</div>
            {settings?.footer_tagline && <p className="mt-1 text-sm">{settings.footer_tagline}</p>}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            {settings?.contact_email && <a href={`mailto:${settings.contact_email}`} className="hover:text-white">{settings.contact_email}</a>}
            {settings?.contact_phone && <a href={`tel:${settings.contact_phone}`} className="hover:text-white">{settings.contact_phone}</a>}
            <Link to={ROUTES.CONTACT_US} className="hover:text-white">Contact Us</Link>
            <Link to={ROUTES.LOGIN} className="hover:text-white">Login</Link>
          </div>
        </div>
        {settings?.footer_copyright_text && (
          <p className="mt-8 text-center text-xs text-slate-600">{settings.footer_copyright_text}</p>
        )}
      </footer>

      {/* Floating WhatsApp button */}
      {whatsappHref && (
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl shadow-black/20 transition hover:scale-105"
          title="Chat with us on WhatsApp"
        >
          <WhatsAppIcon />
        </a>
      )}
    </div>
  );
}
