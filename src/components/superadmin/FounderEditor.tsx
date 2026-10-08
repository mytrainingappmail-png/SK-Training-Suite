// Admin editor for the homepage "Founder" section (Admin → Marketing Website). Everything the public section
// shows is edited here and saved with the rest of the marketing settings.

import { useRef, useState } from "react";
import { normalizeFounder, type FounderContent } from "../../types/platformMarketing";

const INPUT =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {hint && <p className="mb-1.5 text-xs text-slate-400">{hint}</p>}
      {children}
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
      <div>
        <h4 className="text-sm font-bold text-slate-700">{title}</h4>
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** A reorderable list of small cards — each card is whatever `render` draws. */
function ListEditor<T>({
  items, onChange, blank, addLabel, render,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  blank: T;
  addLabel: string;
  render: (item: T, set: (patch: Partial<T>) => void) => React.ReactNode;
}) {
  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="space-y-2">{render(it, (patch) => onChange(items.map((x, k) => (k === i ? { ...x, ...patch } : x))))}</div>
          <div className="mt-2 flex items-center justify-end gap-1 text-xs">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded-lg px-2 py-1 font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Move up">↑</button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="rounded-lg px-2 py-1 font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="Move down">↓</button>
            <button type="button" onClick={() => onChange(items.filter((_, k) => k !== i))} className="rounded-lg px-2 py-1 font-semibold text-red-600 hover:bg-red-50">Delete</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, { ...blank }])} className="rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-white">
        + {addLabel}
      </button>
    </div>
  );
}

function ColorBox({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-slate-200 bg-white p-1" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className={`${INPUT} font-mono`} />
      </div>
    </Field>
  );
}

export default function FounderEditor({
  value, onChange, onUploadPhoto,
}: {
  value: unknown;
  onChange: (next: FounderContent) => void;
  onUploadPhoto: (file: File) => Promise<string>;
}) {
  const f = normalizeFounder(value);
  const set = (patch: Partial<FounderContent>) => onChange({ ...f, ...patch });
  const photoRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try { set({ photo_url: await onUploadPhoto(file) }); } finally { setUploading(false); }
  }

  const lines = (arr: string[]) => arr.join("\n");
  const fromLines = (t: string) => t.split("\n");

  return (
    <section className="space-y-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Founder</h3>
          <p className="mt-1 text-xs text-slate-400">A brand page for the founder: profile, why the product exists, the journey, and a "book a demo" call. Shows on the homepage when switched on.</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={f.enabled} onChange={(e) => set({ enabled: e.target.checked })} className="h-4 w-4" />
          Show on homepage
        </label>
      </div>

      <Group title="Profile">
        <Field label="Photo" hint="A portrait works best — tall (4:5), at least 800×1000px, JPG. Until you add one, a monogram of the initials is shown.">
          <div className="flex flex-wrap items-center gap-3">
            {f.photo_url && <img src={f.photo_url} alt="" className="h-24 w-20 rounded-lg object-cover ring-1 ring-slate-200" />}
            <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            <button type="button" onClick={() => photoRef.current?.click()} disabled={uploading} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {uploading ? "Uploading…" : f.photo_url ? "Replace photo" : "Upload photo"}
            </button>
            {f.photo_url && <button type="button" onClick={() => set({ photo_url: null })} className="text-sm font-semibold text-red-600 hover:underline">Remove</button>}
          </div>
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Small heading above the name"><input value={f.eyebrow} onChange={(e) => set({ eyebrow: e.target.value })} className={INPUT} /></Field>
          <Field label="Name"><input value={f.name} onChange={(e) => set({ name: e.target.value })} className={INPUT} /></Field>
          <Field label="Brand line (under the name)"><input value={f.headline} onChange={(e) => set({ headline: e.target.value })} className={INPUT} /></Field>
          <Field label="Current role / company"><input value={f.role_line} onChange={(e) => set({ role_line: e.target.value })} className={INPUT} /></Field>
        </div>
        <Field label="Tagline (one strong sentence)"><input value={f.tagline} onChange={(e) => set({ tagline: e.target.value })} className={INPUT} /></Field>
        <Field label="About the founder" hint="Leave a blank line between paragraphs.">
          <textarea value={f.bio} onChange={(e) => set({ bio: e.target.value })} rows={9} className={INPUT} />
        </Field>
      </Group>

      <Group title="Numbers" hint="The first number is also shown on the photo. Only add numbers you can stand behind.">
        <ListEditor
          items={f.stats} onChange={(stats) => set({ stats })} blank={{ value: "", label: "" }} addLabel="Add a number"
          render={(it, up) => (
            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <input value={it.value} onChange={(e) => up({ value: e.target.value })} placeholder="25+" className={INPUT} />
              <input value={it.label} onChange={(e) => up({ label: e.target.value })} placeholder="Years of experience" className={INPUT} />
            </div>
          )}
        />
      </Group>

      <Group title="Why this product exists" hint="The problem you are solving — the story visitors read after your profile.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Small heading"><input value={f.why_eyebrow} onChange={(e) => set({ why_eyebrow: e.target.value })} className={INPUT} /></Field>
          <Field label="Headline"><input value={f.why_title} onChange={(e) => set({ why_title: e.target.value })} className={INPUT} /></Field>
        </div>
        <Field label="Introduction"><textarea value={f.why_intro} onChange={(e) => set({ why_intro: e.target.value })} rows={3} className={INPUT} /></Field>
        <Field label="The gaps (cards)">
          <ListEditor
            items={f.gaps} onChange={(gaps) => set({ gaps })} blank={{ icon: "✨", title: "", text: "" }} addLabel="Add a gap"
            render={(it, up) => (
              <>
                <div className="grid grid-cols-[4rem_1fr] gap-2">
                  <input value={it.icon} onChange={(e) => up({ icon: e.target.value })} className={`${INPUT} text-center`} />
                  <input value={it.title} onChange={(e) => up({ title: e.target.value })} placeholder="Title" className={INPUT} />
                </div>
                <textarea value={it.text} onChange={(e) => up({ text: e.target.value })} rows={3} placeholder="Explain it in a sentence or two" className={INPUT} />
              </>
            )}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Comparison — left (the usual way)</p>
            <input value={f.compare_left_label} onChange={(e) => set({ compare_left_label: e.target.value })} placeholder="Label" className={INPUT} />
            <input value={f.compare_left_value} onChange={(e) => set({ compare_left_value: e.target.value })} placeholder="Big text, e.g. ₹6–12 lakh+ / year" className={INPUT} />
            <input value={f.compare_left_note} onChange={(e) => set({ compare_left_note: e.target.value })} placeholder="Small note" className={INPUT} />
          </div>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Comparison — right (your product)</p>
            <input value={f.compare_right_label} onChange={(e) => set({ compare_right_label: e.target.value })} placeholder="Label" className={INPUT} />
            <input value={f.compare_right_value} onChange={(e) => set({ compare_right_value: e.target.value })} placeholder="Big text" className={INPUT} />
            <input value={f.compare_right_note} onChange={(e) => set({ compare_right_note: e.target.value })} placeholder="Small note" className={INPUT} />
          </div>
        </div>
        <Field label="Mission quote"><textarea value={f.mission_quote} onChange={(e) => set({ mission_quote: e.target.value })} rows={2} className={INPUT} /></Field>
      </Group>

      <Group title="The journey" hint="Newest first. The first five show; the rest appear under “Show earlier career”.">
        <ListEditor
          items={f.journey} onChange={(journey) => set({ journey })} blank={{ period: "", role: "", org: "", note: "" }} addLabel="Add a role"
          render={(it, up) => (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input value={it.period} onChange={(e) => up({ period: e.target.value })} placeholder="Apr 2024 – Present" className={INPUT} />
                <input value={it.org} onChange={(e) => up({ org: e.target.value })} placeholder="Company" className={INPUT} />
              </div>
              <input value={it.role} onChange={(e) => up({ role: e.target.value })} placeholder="Role" className={INPUT} />
              <textarea value={it.note} onChange={(e) => up({ note: e.target.value })} rows={2} placeholder="One line about the work" className={INPUT} />
            </>
          )}
        />
      </Group>

      <Group title="Books, expertise and industries">
        <Field label="Books">
          <ListEditor
            items={f.books} onChange={(books) => set({ books })} blank={{ title: "", blurb: "" }} addLabel="Add a book"
            render={(it, up) => (
              <>
                <input value={it.title} onChange={(e) => up({ title: e.target.value })} placeholder="Title" className={INPUT} />
                <textarea value={it.blurb} onChange={(e) => up({ blurb: e.target.value })} rows={3} placeholder="What it is about" className={INPUT} />
              </>
            )}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Expertise" hint="One per line.">
            <textarea value={lines(f.expertise)} onChange={(e) => set({ expertise: fromLines(e.target.value) })} onBlur={() => set({ expertise: f.expertise.map((x) => x.trim()).filter(Boolean) })} rows={8} className={INPUT} />
          </Field>
          <Field label="Industries" hint="One per line.">
            <textarea value={lines(f.industries)} onChange={(e) => set({ industries: fromLines(e.target.value) })} onBlur={() => set({ industries: f.industries.map((x) => x.trim()).filter(Boolean) })} rows={8} className={INPUT} />
          </Field>
        </div>
      </Group>

      <Group title="Book-a-demo call">
        <Field label="Heading"><input value={f.cta_title} onChange={(e) => set({ cta_title: e.target.value })} className={INPUT} /></Field>
        <Field label="Text"><textarea value={f.cta_text} onChange={(e) => set({ cta_text: e.target.value })} rows={2} className={INPUT} /></Field>
        <Field label="Button label" hint="The button scrolls to the contact form. The WhatsApp button appears when a WhatsApp number is set in this page's contact settings.">
          <input value={f.cta_label} onChange={(e) => set({ cta_label: e.target.value })} className={INPUT} />
        </Field>
      </Group>

      <Group title="Colours">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ColorBox label="Background — top" value={f.bg_from} onChange={(v) => set({ bg_from: v })} />
          <ColorBox label="Background — bottom" value={f.bg_to} onChange={(v) => set({ bg_to: v })} />
          <ColorBox label="Highlight colour" value={f.accent} onChange={(v) => set({ accent: v })} />
        </div>
      </Group>
    </section>
  );
}
