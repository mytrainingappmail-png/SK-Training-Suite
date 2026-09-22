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
  loadMarketingUpdates,
  loadMarketingIndustryNews,
  loadPublicPricing,
  loadPublicPlanFeatures,
  submitInquiry,
} from "../services/platformMarketing/platformMarketingService";
import { ROUTES } from "../constants/routes";
import { sanitizeHtml } from "../utils/sanitizeHtml";
import type {
  PlatformMarketingSettings,
  PlatformMarketingFeature,
  PlatformMarketingTestimonial,
  PlatformMarketingUpdate,
  PlatformMarketingIndustryNews,
  PublicSubscriptionPlan,
  PublicPlanFeature,
  InquirySource,
} from "../types/platformMarketing";

/** Matches CertPhotoFrame's naming (src/types/quiz.ts) for one consistent vocabulary across the app. Pure CSS — no canvas needed here. */
function aboutPhotoFrameClass(frame: string): string {
  switch (frame) {
    case "square": return "rounded-none";
    case "rounded_square": return "rounded-2xl";
    case "hexagon": return "rounded-none [clip-path:polygon(25%_0%,75%_0%,100%_50%,75%_100%,25%_100%,0%_50%)]";
    case "oval": return "rounded-full !h-24 !w-36 sm:!h-28 sm:!w-40";
    case "polaroid": return "rounded-sm";
    default: return "rounded-full";
  }
}

interface TickerItem {
  id: string;
  title: string;
  description?: string;
  sourceName?: string | null;
  sourceUrl?: string | null;
}

// One card in the fixed sidebar stack — auto-scrolls its list vertically,
// bottom to top, in a seamless loop (the list is duplicated once so the
// loop point is invisible). Pauses on hover so it's actually readable, and
// respects prefers-reduced-motion. `animationName` must be unique per
// instance on the page — two tickers can't share one @keyframes name.
function SidebarTicker({
  animationName,
  dotColorClass,
  label,
  items,
  heightClass = "h-64",
}: {
  animationName: string;
  dotColorClass: string;
  label: string;
  items: TickerItem[];
  heightClass?: string;
}) {
  if (items.length === 0) return null;
  const durationSec = Math.max(12, items.length * 5);
  const trackClass = `marketing-ticker-track-${animationName}`;

  return (
    <div className="w-72 overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl shadow-black/30 backdrop-blur">
      <style>{`
        @keyframes ${animationName} {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        .${trackClass} {
          animation: ${animationName} ${durationSec}s linear infinite;
        }
        .${trackClass}:hover {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .${trackClass} { animation: none; }
        }
      `}</style>
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className={`flex h-2 w-2 flex-shrink-0 animate-pulse rounded-full ${dotColorClass}`} />
        <span className="text-xs font-bold uppercase tracking-widest text-white">{label}</span>
      </div>
      <div className={`relative ${heightClass} overflow-hidden`}>
        <div className={trackClass}>
          {[...items, ...items].map((item, i) => {
            const Wrapper = item.sourceUrl ? "a" : "div";
            return (
              <Wrapper
                key={`${item.id}-${i}`}
                {...(item.sourceUrl ? { href: item.sourceUrl, target: "_blank", rel: "noopener noreferrer" } : {})}
                className="block border-b border-white/5 px-4 py-3.5 transition hover:bg-white/5"
              >
                <p className="text-sm font-semibold text-white">{item.title}</p>
                {item.description && <p className="mt-1 text-xs leading-relaxed text-slate-400">{item.description}</p>}
                {item.sourceName && <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-400">{item.sourceName} →</p>}
              </Wrapper>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Fixed sidebar stack, near the top of the viewport (not centered) so it
// doesn't compete with whichever section happens to be scrolled to
// mid-page. Hidden on small screens — no room for a fixed side column
// next to real content.
function TickerSidebar({ updates, industryNews }: { updates: PlatformMarketingUpdate[]; industryNews: PlatformMarketingIndustryNews[] }) {
  if (updates.length === 0 && industryNews.length === 0) return null;
  return (
    <div className="fixed right-6 top-20 z-30 hidden space-y-4 lg:block">
      <SidebarTicker
        animationName="marketing-updates-scroll"
        dotColorClass="bg-emerald-400"
        label="What's New"
        heightClass="h-48"
        items={updates.map((u) => ({ id: u.id, title: u.title, description: u.description }))}
      />
      <SidebarTicker
        animationName="marketing-industry-news-scroll"
        dotColorClass="bg-amber-400"
        label="Real Estate Industry News"
        heightClass="h-48"
        items={industryNews.map((n) => ({ id: n.id, title: n.title, description: n.description, sourceName: n.source_name, sourceUrl: n.source_url }))}
      />
    </div>
  );
}

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
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border-2 border-slate-200 bg-white p-8 shadow-sm">
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
              source === opt.value ? "text-white" : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
            style={source === opt.value ? { backgroundImage: "linear-gradient(to right, var(--rt-accent-from), var(--rt-accent-to))", borderColor: "transparent" } : undefined}
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
        className="w-full rounded-xl px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition hover:opacity-90 disabled:opacity-50"
        style={{ backgroundImage: "linear-gradient(to right, var(--rt-accent-from), var(--rt-accent-to))" }}
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
  const [updates, setUpdates] = useState<PlatformMarketingUpdate[]>([]);
  const [industryNews, setIndustryNews] = useState<PlatformMarketingIndustryNews[]>([]);
  const [plans, setPlans] = useState<PublicSubscriptionPlan[]>([]);
  const [planFeatures, setPlanFeatures] = useState<PublicPlanFeature[]>([]);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "six_month" | "yearly">("monthly");
  const [openTip, setOpenTip] = useState<string | null>(null);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadMarketingSettings(), loadMarketingFeatures(), loadMarketingTestimonials(), loadMarketingUpdates(), loadMarketingIndustryNews(), loadPublicPricing(), loadPublicPlanFeatures()])
      .then(([s, f, t, u, n, p, pf]) => {
        setSettings(s);
        setFeatures(f);
        setTestimonials(t);
        setUpdates(u);
        setIndustryNews(n);
        setPlans(p);
        setPlanFeatures(pf);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!openTip) return;
    const close = () => setOpenTip(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openTip]);

  if (loading) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  const companyName = settings?.footer_company_name?.trim() || "Training Suite";
  const brandName = settings?.brand_name?.trim() || "RealTrainer";
  // Design controls (Admin -> Marketing Website -> Design) as CSS custom properties on the
  // page's root element — every accent/background color below reads these instead of a
  // hardcoded Tailwind color, and they cascade to nested components (QueryForm) for free.
  const designVars: React.CSSProperties = {
    ["--rt-accent-from" as string]: settings?.accent_from || "#4F46E5",
    ["--rt-accent-to" as string]: settings?.accent_to || "#7C3AED",
  };
  const accentGradient = "linear-gradient(to right, var(--rt-accent-from), var(--rt-accent-to))";
  const accentColor = "var(--rt-accent-from)";
  const heroFrom = settings?.hero_bg_from || "#1E1B4B";
  const heroTo = settings?.hero_bg_to || "#020617";
  const aboutFrom = settings?.about_bg_from || "#020617";
  const aboutTo = settings?.about_bg_to || "#1E1B4B";
  const heroAlign = settings?.hero_align === "left" ? "left" : "center";
  const aboutLight = settings?.about_text_light !== false;
  const logoHeight = 36 * ((settings?.logo_scale || 100) / 100);
  const whatsappHref = settings?.whatsapp_number
    ? `https://wa.me/${settings.whatsapp_number.replace(/\D/g, "")}?text=${encodeURIComponent(settings.whatsapp_default_message || "Hi, I would like to know more.")}`
    : null;

  return (
    <div className="min-h-screen bg-white text-slate-900 lg:pr-80" style={designVars}>
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt={brandName} className="w-auto object-contain" style={{ height: `${logoHeight}px` }} />
            ) : (
              <div className="rounded-lg" style={{ backgroundImage: accentGradient, height: `${logoHeight}px`, width: `${logoHeight}px` }} />
            )}
            <div className="leading-tight">
              <span className="block text-lg font-bold tracking-tight">{brandName}</span>
              {settings?.brand_tagline && (
                <span className="block text-[11px] font-medium text-slate-500">{settings.brand_tagline}</span>
              )}
            </div>
          </div>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex">
            {settings?.about_content_html && <a href="#about" className="transition hover:text-slate-900">About Us</a>}
            {features.length > 0 && <a href="#why-us" className="transition hover:text-slate-900">Why Us</a>}
            {testimonials.length > 0 && <a href="#testimonials" className="transition hover:text-slate-900">Testimonials</a>}
            {plans.length > 0 && <a href="#pricing" className="transition hover:text-slate-900">Pricing</a>}
            <a href="#get-started" className="transition hover:text-slate-900">Contact</a>
          </nav>

          <Link
            to={ROUTES.LOGIN}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Login
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section
        className="relative overflow-hidden bg-cover bg-center px-6 py-24 text-white"
        style={{
          backgroundImage: settings?.hero_image_url
            ? `linear-gradient(to bottom, ${heroFrom}cc, ${heroTo}e6), url(${settings.hero_image_url})`
            : `linear-gradient(to bottom, ${heroFrom}, ${heroTo})`,
        }}
      >
        {!settings?.hero_image_url && (
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage: "radial-gradient(circle at 20% 20%, #6366F1 0%, transparent 40%), radial-gradient(circle at 80% 60%, #A855F7 0%, transparent 40%)",
            }}
          />
        )}
        <div className={`relative mx-auto max-w-3xl ${heroAlign === "left" ? "text-left" : "text-center"}`}>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {settings?.hero_title}
          </h1>
          <p className={`mt-5 max-w-xl text-lg text-slate-300 ${heroAlign === "left" ? "" : "mx-auto"}`}>{settings?.hero_subtitle}</p>
          <div className={`mt-9 flex flex-wrap items-center gap-4 ${heroAlign === "left" ? "justify-start" : "justify-center"}`}>
            <a
              href="#get-started"
              className="rounded-xl px-7 py-3.5 text-sm font-bold text-white shadow-lg transition hover:opacity-90"
              style={{ backgroundImage: accentGradient }}
            >
              {settings?.hero_cta_label} →
            </a>
            <Link to={ROUTES.LOGIN} className="text-sm font-semibold text-slate-300 hover:text-white">
              Already a customer? Sign in →
            </Link>
          </div>
        </div>
      </section>

      {/* About — dark navy band, matching the hero, so the page reads as a
          deliberate light/dark rhythm rather than one long white scroll. */}
      {settings?.about_content_html && (
        <section
          id="about"
          className={`px-6 py-20 ${aboutLight ? "text-white" : "text-slate-900"}`}
          style={{ backgroundImage: `linear-gradient(to bottom, ${aboutFrom}, ${aboutTo})` }}
        >
          <div className="mx-auto max-w-3xl">
            {settings.about_photo_url && (
              settings.about_photo_frame === "polaroid" ? (
                <div className="mx-auto mb-6 w-fit -rotate-2 rounded-sm bg-white p-2.5 pb-5 shadow-xl">
                  <img src={settings.about_photo_url} alt="" className="h-28 w-28 object-cover sm:h-32 sm:w-32" />
                </div>
              ) : (
                <img
                  src={settings.about_photo_url}
                  alt=""
                  className={`mx-auto mb-6 h-28 w-28 object-cover ring-4 sm:h-32 sm:w-32 ${aboutPhotoFrameClass(settings.about_photo_frame)} ${aboutLight ? "ring-white/10" : "ring-black/5"}`}
                />
              )
            )}
            <h2 className={`text-center text-3xl font-bold tracking-tight ${aboutLight ? "text-white" : "text-slate-900"}`}>{settings.about_title}</h2>
            <div
              className={`prose mx-auto mt-8 max-w-none ${
                aboutLight
                  ? "prose-invert prose-slate prose-headings:text-white prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-white"
                  : "prose-slate prose-headings:text-slate-900 prose-p:text-slate-700 prose-li:text-slate-700 prose-strong:text-slate-900"
              }`}
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(settings.about_content_html) }}
            />
          </div>
        </section>
      )}

      {/* Features */}
      {features.length > 0 && (
        <section id="why-us" className="bg-gradient-to-b from-indigo-50 via-indigo-50/40 to-white px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <p className="text-center text-sm font-bold uppercase tracking-widest" style={{ color: accentColor }}>Why Choose Us</p>
            <h2 className="mt-2 text-center text-3xl font-bold tracking-tight text-slate-900">Everything you need, built in</h2>
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div
                  key={f.id}
                  className="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-2xl shadow-md shadow-indigo-500/25">
                    {f.icon}
                  </div>
                  <h3 className="mt-4 text-base font-bold text-slate-900">{f.title}</h3>
                  {f.description && <p className="mt-1.5 text-sm text-slate-600">{f.description}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <section id="testimonials" className="px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <p className="text-center text-sm font-bold uppercase tracking-widest" style={{ color: accentColor }}>Testimonials</p>
            <h2 className="mt-2 text-center text-3xl font-bold tracking-tight text-slate-900">What Our Customers Say</h2>
            <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {testimonials.map((t) => (
                <div key={t.id} className="flex flex-col rounded-2xl border-2 border-slate-200 border-l-4 border-l-indigo-500 bg-white p-6 shadow-sm">
                  <div className="text-amber-400">{"★".repeat(t.rating)}{"☆".repeat(5 - t.rating)}</div>
                  <p className="mt-3 flex-1 text-sm italic text-slate-800">“{t.quote}”</p>
                  <div className="mt-4 flex items-center gap-3">
                    {t.photo_url && <img src={t.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />}
                    <div>
                      <div className="text-sm font-bold text-slate-900">{t.name}</div>
                      {t.role_or_company && <div className="text-xs text-slate-600">{t.role_or_company}</div>}
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
        <section id="pricing" className="bg-gradient-to-b from-violet-50 via-violet-50/40 to-white px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <p className="text-center text-sm font-bold uppercase tracking-widest" style={{ color: accentColor }}>Pricing</p>
            <h2 className="mt-2 text-center text-3xl font-bold tracking-tight text-slate-900">Simple, Transparent Pricing</h2>
            <div className="mt-6 flex justify-center">
              <div className="inline-flex flex-wrap justify-center rounded-xl border-2 border-slate-200 bg-white p-1">
                {([
                  ["monthly", "Monthly"],
                  ...(plans.some((p) => p.six_month_discount_pct !== null) ? [["six_month", "6 Months"]] as const : []),
                  ["yearly", "Yearly"],
                ] as const).map(([cycle, label]) => (
                  <button
                    key={cycle}
                    onClick={() => setBillingCycle(cycle)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      billingCycle === cycle ? "text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                    }`}
                    style={billingCycle === cycle ? { backgroundImage: accentGradient } : undefined}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3 md:items-start">
              {plans.map((p, i) => {
                const featured = plans.length >= 3 && i === 1;
                const moduleItems = planFeatures.filter((pf) => pf.plan_id === p.id);
                const textItems = p.features.split(",").map((f) => f.trim()).filter(Boolean);
                const ALWAYS_SHOWN = 5; // employees + courses count as 2 of these
                const totalCount = 2 + moduleItems.length + textItems.length;
                const expanded = expandedPlan === p.id;
                const moduleShowCount = expanded ? moduleItems.length : Math.max(0, ALWAYS_SHOWN - 2);
                const textShowCount = expanded ? textItems.length : Math.max(0, ALWAYS_SHOWN - 2 - moduleItems.length);
                const hiddenCount = totalCount - 2 - moduleShowCount - textShowCount;
                return (
                  <div
                    key={p.id}
                    className={`relative flex flex-col rounded-2xl border-2 bg-white p-7 transition hover:-translate-y-0.5 ${
                      featured
                        ? "shadow-xl shadow-indigo-500/15 md:scale-105"
                        : "border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md"
                    }`}
                    style={featured ? { borderColor: accentColor } : undefined}
                  >
                    {featured && (
                      <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-md" style={{ backgroundImage: accentGradient }}>
                        Most Popular
                      </span>
                    )}
                    <h3 className="text-lg font-bold text-slate-900">{p.plan_name}</h3>
                    {p.description && <p className="mt-1 text-sm text-slate-600">{p.description}</p>}
                    {(() => {
                      const usingCycle = billingCycle === "six_month" && p.six_month_discount_pct === null ? "monthly" : billingCycle;
                      const shown = usingCycle === "yearly" ? p.price_yearly : usingCycle === "six_month" ? (p.price_six_month ?? p.price_monthly * 6) : p.price_monthly;
                      const suffix = usingCycle === "yearly" ? "yr" : usingCycle === "six_month" ? "6mo" : "mo";
                      const discountPct = usingCycle === "yearly" ? p.yearly_discount_pct : usingCycle === "six_month" ? p.six_month_discount_pct ?? 0 : 0;
                      return (
                        <div className="mt-5">
                          <span className="text-3xl font-extrabold text-slate-900">₹{shown.toLocaleString()}</span>
                          <span className="text-sm text-slate-600">/{suffix}</span>
                          {discountPct > 0 && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">Save {discountPct}%</span>}
                          {billingCycle === "six_month" && p.six_month_discount_pct === null && (
                            <p className="mt-1 text-xs text-slate-400">6-month billing isn't offered on this plan — showing the monthly price.</p>
                          )}
                        </div>
                      );
                    })()}
                    <ul className="mt-5 flex-1 space-y-2.5 text-sm text-slate-700">
                      <li className="flex items-center gap-2.5">
                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs">👥</span>
                        Up to {p.max_employees.toLocaleString()} employees
                      </li>
                      <li className="flex items-center gap-2.5">
                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs">📚</span>
                        Up to {p.max_courses.toLocaleString()} courses
                      </li>
                      {moduleItems.slice(0, moduleShowCount).map((pf) => (
                        <li key={pf.module_key} className="relative flex items-start gap-2.5">
                          <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs text-emerald-600">✓</span>
                          <span className="flex-1">{pf.label}</span>
                          {pf.description && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setOpenTip(openTip === pf.module_key ? null : pf.module_key); }}
                              className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 hover:bg-slate-200"
                              aria-label={`What is ${pf.label}?`}
                            >
                              i
                            </button>
                          )}
                          {openTip === pf.module_key && pf.description && (
                            <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-6 z-20 w-56 rounded-xl bg-slate-900 p-3 text-xs leading-relaxed text-white shadow-xl">
                              {pf.description}
                            </div>
                          )}
                        </li>
                      ))}
                      {textItems.slice(0, textShowCount).map((f) => (
                        <li key={f} className="flex items-center gap-2.5">
                          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs text-emerald-600">✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                    {(hiddenCount > 0 || expanded) && (
                      <button
                        type="button"
                        onClick={() => setExpandedPlan(expanded ? null : p.id)}
                        className="mt-2 text-left text-xs font-semibold hover:opacity-80"
                        style={{ color: accentColor }}
                      >
                        {expanded ? "Show less ▲" : `+ ${hiddenCount} more benefit${hiddenCount === 1 ? "" : "s"} · Read more ▼`}
                      </button>
                    )}
                    <a
                      href="#get-started"
                      className={`mt-6 rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition ${
                        featured ? "text-white shadow-lg shadow-indigo-500/25 hover:opacity-90" : "bg-slate-900 text-white hover:bg-slate-800"
                      }`}
                      style={featured ? { backgroundImage: accentGradient } : undefined}
                    >
                      Get Started
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Get Started / Query Form */}
      <section id="get-started" className="px-6 py-20">
        <div className="mx-auto max-w-md">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900">Get Started</h2>
          <p className="mt-3 text-center text-sm text-slate-600">Tell us a bit about you and we'll be in touch.</p>
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

      <TickerSidebar updates={updates} industryNews={industryNews} />

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
