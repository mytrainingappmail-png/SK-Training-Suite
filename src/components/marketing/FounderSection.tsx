// The "Founder" block of the public homepage: the founder presented as a brand, the story of why the product
// exists, and a call to book a demo. Every word, number, colour and the photo come from the `founder` jsonb on
// platform_marketing_settings (Admin → Marketing Website → Founder) — nothing here is hardcoded. A section whose
// content is empty simply doesn't render, so the admin can keep only what they want.

import { useState } from "react";
import type { FounderContent } from "../../types/platformMarketing";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

const JOURNEY_PREVIEW = 5;

export default function FounderSection({ founder, whatsappHref }: { founder: FounderContent; whatsappHref: string | null }) {
  const [showAllCareer, setShowAllCareer] = useState(false);
  if (!founder.enabled || !founder.name.trim()) return null;

  const accent = founder.accent || "#D4A93A";
  const vars = {
    ["--f-accent" as string]: accent,
    ["--f-from" as string]: founder.bg_from || "#0B1B3A",
    ["--f-to" as string]: founder.bg_to || "#12274D",
  } as React.CSSProperties;
  const darkBg = { backgroundImage: "linear-gradient(160deg, var(--f-from), var(--f-to))" };
  const paragraphs = founder.bio.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const journey = showAllCareer ? founder.journey : founder.journey.slice(0, JOURNEY_PREVIEW);
  const hasWhy = founder.why_title.trim() || founder.gaps.length > 0;
  const hasStory = founder.journey.length > 0 || founder.books.length > 0 || founder.expertise.length > 0;

  return (
    <div id="founder" style={vars}>
      {/* ── 1. Founder as a brand ── */}
      <section className="relative overflow-hidden px-5 py-16 text-white sm:px-6 sm:py-24" style={darkBg}>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage: "radial-gradient(circle at 85% 15%, var(--f-accent) 0%, transparent 38%), radial-gradient(circle at 5% 90%, #6366F1 0%, transparent 35%)" }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div>
            {founder.eyebrow && (
              <p className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.25em]" style={{ color: accent }}>
                <span className="h-px w-10" style={{ backgroundColor: accent }} />
                {founder.eyebrow}
              </p>
            )}
            <h2 className="mt-4 font-serif text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">{founder.name}</h2>
            {founder.headline && (
              <p className="mt-3 text-sm font-bold uppercase tracking-[0.18em] sm:text-base" style={{ color: accent }}>{founder.headline}</p>
            )}
            {founder.role_line && <p className="mt-2 text-sm text-slate-300">{founder.role_line}</p>}
            {founder.tagline && (
              <p className="mt-6 border-l-2 pl-4 font-serif text-lg italic leading-relaxed text-slate-100 sm:text-xl" style={{ borderColor: accent }}>
                {founder.tagline}
              </p>
            )}
            <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-slate-300">
              {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {founder.cta_label && (
                <a href="#get-started" className="rounded-xl px-6 py-3 text-sm font-bold text-slate-900 shadow-lg transition hover:brightness-110" style={{ backgroundColor: accent }}>
                  {founder.cta_label} →
                </a>
              )}
              {whatsappHref && (
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/25 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                  Chat on WhatsApp
                </a>
              )}
            </div>
          </div>

          {/* Portrait — the photo is uploaded in Admin; until then a monogram holds the space. */}
          <div className="mx-auto w-full max-w-sm lg:max-w-none">
            <div className="relative mx-auto aspect-[4/5] w-full max-w-sm">
              <div className="absolute inset-0 translate-x-4 translate-y-4 rounded-[2rem] border-2" style={{ borderColor: accent, opacity: 0.55 }} />
              <div className="relative h-full w-full overflow-hidden rounded-[2rem] shadow-2xl ring-1 ring-white/15" style={{ backgroundImage: "linear-gradient(160deg, #1B2F5C, #0A1530)" }}>
                {founder.photo_url ? (
                  <img src={founder.photo_url} alt={founder.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                    <div className="flex h-36 w-36 items-center justify-center rounded-full border-2 font-serif text-6xl font-bold sm:h-44 sm:w-44 sm:text-7xl" style={{ borderColor: accent, color: accent }}>
                      {initialsOf(founder.name)}
                    </div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-slate-400">{founder.headline}</p>
                  </div>
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent" />
              </div>
              {founder.stats[0] && (
                <div className="absolute -bottom-5 -left-3 rounded-2xl px-5 py-3 text-slate-900 shadow-xl sm:-left-6" style={{ backgroundColor: accent }}>
                  <div className="font-serif text-3xl font-bold leading-none">{founder.stats[0].value}</div>
                  <div className="mt-1 text-[11px] font-bold uppercase tracking-wider">{founder.stats[0].label}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {founder.stats.length > 0 && (
          <div className="relative mx-auto mt-16 grid max-w-6xl grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10 sm:grid-cols-3 lg:grid-cols-5">
            {founder.stats.map((s, i) => (
              <div key={i} className="bg-white/[0.04] px-5 py-5 text-center">
                <div className="font-serif text-3xl font-bold sm:text-4xl" style={{ color: accent }}>{s.value}</div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wider text-slate-300">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── 2. Why this product exists ── */}
      {hasWhy && (
        <section className="bg-gradient-to-b from-slate-50 to-white px-5 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-5xl">
            {founder.why_eyebrow && <p className="text-center text-xs font-bold uppercase tracking-[0.25em]" style={{ color: "color-mix(in srgb, var(--f-accent) 70%, #7a5a00)" }}>{founder.why_eyebrow}</p>}
            {founder.why_title && <h3 className="mx-auto mt-3 max-w-3xl text-center font-serif text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">{founder.why_title}</h3>}
            {founder.why_intro && <p className="mx-auto mt-5 max-w-2xl text-center text-base leading-relaxed text-slate-600">{founder.why_intro}</p>}

            {founder.gaps.length > 0 && (
              <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
                {founder.gaps.map((g, i) => (
                  <div key={i} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl" style={{ backgroundImage: "linear-gradient(135deg, var(--f-from), var(--f-to))" }}>{g.icon}</div>
                    <h4 className="mt-4 text-lg font-bold text-slate-900">{g.title}</h4>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{g.text}</p>
                  </div>
                ))}
              </div>
            )}

            {(founder.compare_left_value || founder.compare_right_value) && (
              <div className="relative mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{founder.compare_left_label}</p>
                  <p className="mt-3 font-serif text-3xl font-bold text-slate-800 sm:text-4xl">{founder.compare_left_value}</p>
                  <p className="mt-3 text-sm text-slate-500">{founder.compare_left_note}</p>
                </div>
                <div className="rounded-2xl p-7 text-center text-white shadow-xl ring-2" style={{ ...darkBg, ["--tw-ring-color" as string]: accent }}>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>{founder.compare_right_label}</p>
                  <p className="mt-3 font-serif text-3xl font-bold sm:text-4xl">{founder.compare_right_value}</p>
                  <p className="mt-3 text-sm text-slate-300">{founder.compare_right_note}</p>
                </div>
                <div className="absolute left-1/2 top-1/2 z-10 hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-xs font-extrabold text-slate-500 shadow-lg ring-1 ring-slate-200 md:flex">VS</div>
              </div>
            )}

            {founder.mission_quote && (
              <figure className="mx-auto mt-14 max-w-3xl text-center">
                <div className="font-serif text-6xl leading-none" style={{ color: accent }}>“</div>
                <blockquote className="-mt-3 font-serif text-2xl font-semibold leading-snug text-slate-900 sm:text-3xl">{founder.mission_quote}</blockquote>
                <figcaption className="mt-5 text-sm font-semibold text-slate-500">— {founder.name}</figcaption>
              </figure>
            )}
          </div>
        </section>
      )}

      {/* ── 3. The journey, books and expertise ── */}
      {hasStory && (
        <section className="bg-white px-5 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[1.1fr_0.9fr]">
            {founder.journey.length > 0 && (
              <div>
                <h3 className="font-serif text-3xl font-bold tracking-tight text-slate-900">The journey</h3>
                <p className="mt-1 text-sm text-slate-500">From the sales floor to building learning ecosystems.</p>
                <ol className="relative mt-8 space-y-7 border-l-2 pl-7" style={{ borderColor: "color-mix(in srgb, var(--f-accent) 45%, white)" }}>
                  {journey.map((j, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[2.15rem] top-1.5 h-3.5 w-3.5 rounded-full ring-4 ring-white" style={{ backgroundColor: accent }} />
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{j.period}</p>
                      <p className="mt-0.5 text-base font-bold text-slate-900">{j.role}</p>
                      <p className="text-sm font-semibold" style={{ color: "color-mix(in srgb, var(--f-accent) 60%, #6b4e00)" }}>{j.org}</p>
                      {j.note && <p className="mt-1 text-sm leading-relaxed text-slate-600">{j.note}</p>}
                    </li>
                  ))}
                </ol>
                {founder.journey.length > JOURNEY_PREVIEW && (
                  <button
                    type="button"
                    onClick={() => setShowAllCareer((v) => !v)}
                    className="mt-7 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    {showAllCareer ? "Show less" : `Show earlier career (${founder.journey.length - JOURNEY_PREVIEW} more)`}
                  </button>
                )}
              </div>
            )}

            <div className="space-y-10">
              {founder.books.length > 0 && (
                <div>
                  <h3 className="font-serif text-3xl font-bold tracking-tight text-slate-900">Author</h3>
                  <div className="mt-5 space-y-4">
                    {founder.books.map((b, i) => (
                      <div key={i} className="flex gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                        <div className="flex h-16 w-12 flex-shrink-0 items-center justify-center rounded-md font-serif text-xl font-bold shadow-md" style={{ ...darkBg, color: accent }}>
                          {i + 1}
                        </div>
                        <div>
                          <p className="font-serif text-lg font-bold leading-snug text-slate-900">{b.title}</p>
                          <p className="mt-1 text-sm leading-relaxed text-slate-600">{b.blurb}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {founder.expertise.length > 0 && (
                <div>
                  <h3 className="font-serif text-2xl font-bold tracking-tight text-slate-900">Expertise</h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {founder.expertise.map((e, i) => (
                      <span key={i} className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm">{e}</span>
                    ))}
                  </div>
                </div>
              )}

              {founder.industries.length > 0 && (
                <div>
                  <h3 className="font-serif text-2xl font-bold tracking-tight text-slate-900">Industries</h3>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {founder.industries.map((e, i) => (
                      <span key={i} className="rounded-full px-3.5 py-1.5 text-xs font-bold text-white" style={darkBg}>{e}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 4. Book a demo ── */}
      {(founder.cta_title || founder.cta_text) && (
        <section className="px-5 py-16 text-center text-white sm:px-6 sm:py-20" style={darkBg}>
          <div className="mx-auto max-w-2xl">
            {founder.cta_title && <h3 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">{founder.cta_title}</h3>}
            {founder.cta_text && <p className="mt-4 text-base leading-relaxed text-slate-300">{founder.cta_text}</p>}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {founder.cta_label && (
                <a href="#get-started" className="rounded-xl px-7 py-3.5 text-sm font-bold text-slate-900 shadow-lg transition hover:brightness-110" style={{ backgroundColor: accent }}>
                  {founder.cta_label} →
                </a>
              )}
              {whatsappHref && (
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-white/25 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10">
                  Chat on WhatsApp
                </a>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
