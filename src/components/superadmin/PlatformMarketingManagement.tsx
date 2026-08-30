import { useEffect, useRef, useState } from "react";

import {
  loadMarketingSettings,
  saveMarketingSettings,
  loadMarketingFeatures,
  addMarketingFeature,
  editMarketingFeature,
  removeMarketingFeature,
  loadMarketingTestimonials,
  addMarketingTestimonial,
  editMarketingTestimonial,
  removeMarketingTestimonial,
  loadInquiries,
  setInquiryStatus,
} from "../../services/platformMarketing/platformMarketingService";
import { uploadToCourseContent } from "../../lib/mediaUpload";
import { uploadImage } from "../../services/contentEditor/contentEditorService";
import RichTextEditor from "../shared/RichTextEditor";
import type {
  PlatformMarketingSettings,
  PlatformMarketingFeature,
  PlatformMarketingTestimonial,
  PlatformMarketingInquiry,
  InquiryStatus,
} from "../../types/platformMarketing";

const CLS_INPUT =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 disabled:cursor-not-allowed disabled:bg-slate-50";

function FL({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {hint && <p className="mb-1.5 text-xs text-slate-400">{hint}</p>}
      {children}
    </div>
  );
}

async function uploadInlineImage(file: File): Promise<string> {
  const { url } = await uploadImage(file);
  return url;
}

function FeatureRow({
  feature,
  onSave,
  onDelete,
  onMove,
  isFirst,
  isLast,
}: {
  feature: PlatformMarketingFeature;
  onSave: (id: string, patch: { icon: string; title: string; description: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMove: (id: string, direction: "up" | "down") => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [icon, setIcon] = useState(feature.icon);
  const [title, setTitle] = useState(feature.title);
  const [description, setDescription] = useState(feature.description);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  function change<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(feature.id, { icon, title, description });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
      <input
        value={icon}
        onChange={(e) => change(setIcon)(e.target.value)}
        maxLength={4}
        className="w-14 rounded-lg border border-slate-200 bg-white px-2 py-2 text-center text-lg"
        title="Emoji shown as this feature's icon"
      />
      <div className="flex-1 space-y-2">
        <input
          value={title}
          onChange={(e) => change(setTitle)(e.target.value)}
          placeholder="Feature title"
          className={CLS_INPUT}
        />
        <textarea
          value={description}
          onChange={(e) => change(setDescription)(e.target.value)}
          placeholder="Short description"
          rows={2}
          className={CLS_INPUT}
        />
      </div>
      <div className="flex flex-col items-end gap-2">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onMove(feature.id, "up")}
            disabled={isFirst}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(feature.id, "down")}
            disabled={isLast}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-30"
          >
            ↓
          </button>
        </div>
        {dirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(feature.id)}
          className="rounded-lg bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-500/20"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function TestimonialRow({
  testimonial,
  onSave,
  onDelete,
}: {
  testimonial: PlatformMarketingTestimonial;
  onSave: (id: string, patch: { name: string; role_or_company: string | null; quote: string; photo_url: string | null; rating: number }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState(testimonial.name);
  const [role, setRole] = useState(testimonial.role_or_company ?? "");
  const [quote, setQuote] = useState(testimonial.quote);
  const [rating, setRating] = useState(testimonial.rating);
  const [photoUrl, setPhotoUrl] = useState(testimonial.photo_url);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  function change<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const url = await uploadToCourseContent(file, "images/testimonials", testimonial.id);
      setPhotoUrl(url);
      setDirty(true);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(testimonial.id, { name, role_or_company: role || null, quote, photo_url: photoUrl, rating });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex flex-col items-center gap-1">
        {photoUrl && <img src={photoUrl} alt="" className="h-12 w-12 rounded-full object-cover ring-1 ring-slate-200" />}
        <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
        <button type="button" onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto} className="text-[11px] font-semibold text-indigo-600 hover:underline disabled:opacity-50">
          {uploadingPhoto ? "…" : photoUrl ? "Replace" : "Add photo"}
        </button>
      </div>
      <div className="flex-1 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input value={name} onChange={(e) => change(setName)(e.target.value)} placeholder="Name" className={CLS_INPUT} />
          <input value={role} onChange={(e) => change(setRole)(e.target.value)} placeholder="Role / Company (optional)" className={CLS_INPUT} />
        </div>
        <textarea value={quote} onChange={(e) => change(setQuote)(e.target.value)} placeholder="What they said" rows={2} className={CLS_INPUT} />
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" onClick={() => change(setRating)(n)} className="text-lg leading-none">
              {n <= rating ? "★" : "☆"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        {dirty && (
          <button type="button" onClick={handleSave} disabled={saving} className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        )}
        <button type="button" onClick={() => onDelete(testimonial.id)} className="rounded-lg bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-500/20">
          Delete
        </button>
      </div>
    </div>
  );
}

const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  new: "New",
  contacted: "Contacted",
  converted: "Converted",
  dismissed: "Dismissed",
};

const INQUIRY_STATUS_COLOR: Record<InquiryStatus, string> = {
  new: "bg-amber-100 text-amber-700",
  contacted: "bg-blue-100 text-blue-700",
  converted: "bg-emerald-100 text-emerald-700",
  dismissed: "bg-slate-200 text-slate-500",
};

function InquiryRow({ inquiry, onStatusChange }: { inquiry: PlatformMarketingInquiry; onStatusChange: (id: string, status: InquiryStatus) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-800">{inquiry.name}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${inquiry.source === "trial" ? "bg-violet-100 text-violet-700" : "bg-slate-200 text-slate-600"}`}>
            {inquiry.source === "trial" ? "Trial Request" : "Query"}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {inquiry.company_name && <>{inquiry.company_name} · </>}
          {inquiry.phone && <>{inquiry.phone} · </>}
          {inquiry.email}
        </p>
        {inquiry.message && <p className="mt-1 text-xs text-slate-600">{inquiry.message}</p>}
        <p className="mt-1 text-[11px] text-slate-400">{new Date(inquiry.created_at).toLocaleString()}</p>
      </div>
      <select
        value={inquiry.status}
        onChange={(e) => onStatusChange(inquiry.id, e.target.value as InquiryStatus)}
        className={`rounded-lg border-0 px-2.5 py-1.5 text-xs font-semibold ${INQUIRY_STATUS_COLOR[inquiry.status]}`}
      >
        {(Object.keys(INQUIRY_STATUS_LABEL) as InquiryStatus[]).map((s) => (
          <option key={s} value={s}>{INQUIRY_STATUS_LABEL[s]}</option>
        ))}
      </select>
    </div>
  );
}

export default function PlatformMarketingManagement() {
  const [settings, setSettings] = useState<PlatformMarketingSettings | null>(null);
  const [features, setFeatures] = useState<PlatformMarketingFeature[]>([]);
  const [testimonials, setTestimonials] = useState<PlatformMarketingTestimonial[]>([]);
  const [inquiries, setInquiries] = useState<PlatformMarketingInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([loadMarketingSettings(), loadMarketingFeatures(), loadMarketingTestimonials(), loadInquiries()])
      .then(([s, f, t, i]) => {
        setSettings(s);
        setFeatures(f);
        setTestimonials(t);
        setInquiries(i);
      })
      .finally(() => setLoading(false));
  }, []);

  function field<K extends keyof PlatformMarketingSettings>(key: K, val: PlatformMarketingSettings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: val } : prev));
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setMessage("");
    try {
      const updated = await saveMarketingSettings(settings.id, {
        logo_url: settings.logo_url,
        hero_title: settings.hero_title,
        hero_subtitle: settings.hero_subtitle,
        hero_cta_label: settings.hero_cta_label,
        about_title: settings.about_title,
        about_content_html: settings.about_content_html,
        footer_company_name: settings.footer_company_name,
        footer_tagline: settings.footer_tagline,
        footer_copyright_text: settings.footer_copyright_text,
        whatsapp_number: settings.whatsapp_number,
        whatsapp_default_message: settings.whatsapp_default_message,
        contact_email: settings.contact_email,
        contact_phone: settings.contact_phone,
      });
      setSettings(updated);
      setMessage("Saved.");
      setTimeout(() => setMessage(""), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !settings) return;
    setUploadingLogo(true);
    try {
      const url = await uploadToCourseContent(file, "images/platform-marketing", "logo");
      field("logo_url", url);
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleAddFeature() {
    const created = await addMarketingFeature({
      icon: "✨",
      title: "New Feature",
      description: "",
      display_order: features.length,
    });
    setFeatures((prev) => [...prev, created]);
  }

  async function handleSaveFeature(id: string, patch: { icon: string; title: string; description: string }) {
    const updated = await editMarketingFeature(id, patch);
    setFeatures((prev) => prev.map((f) => (f.id === id ? updated : f)));
  }

  async function handleDeleteFeature(id: string) {
    await removeMarketingFeature(id);
    setFeatures((prev) => prev.filter((f) => f.id !== id));
  }

  async function handleMoveFeature(id: string, direction: "up" | "down") {
    const index = features.findIndex((f) => f.id === id);
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= features.length) return;

    const reordered = [...features];
    [reordered[index], reordered[swapWith]] = [reordered[swapWith], reordered[index]];
    setFeatures(reordered);

    await Promise.all(
      reordered.map((f, i) => (f.display_order !== i ? editMarketingFeature(f.id, { display_order: i }) : Promise.resolve(f)))
    );
  }

  async function handleAddTestimonial() {
    const created = await addMarketingTestimonial({
      name: "New Customer",
      role_or_company: null,
      quote: "",
      photo_url: null,
      rating: 5,
      display_order: testimonials.length,
    });
    setTestimonials((prev) => [...prev, created]);
  }

  async function handleSaveTestimonial(id: string, patch: { name: string; role_or_company: string | null; quote: string; photo_url: string | null; rating: number }) {
    const updated = await editMarketingTestimonial(id, patch);
    setTestimonials((prev) => prev.map((t) => (t.id === id ? updated : t)));
  }

  async function handleDeleteTestimonial(id: string) {
    await removeMarketingTestimonial(id);
    setTestimonials((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleInquiryStatusChange(id: string, status: InquiryStatus) {
    const updated = await setInquiryStatus(id, status);
    setInquiries((prev) => prev.map((i) => (i.id === id ? updated : i)));
  }

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />;
  if (!settings) return <div className="text-sm text-red-500">Could not load marketing page settings.</div>;

  return (
    <div className="space-y-6 pb-16">
      <div>
        <h2 className="text-lg font-bold text-slate-800">🌐 Marketing Website</h2>
        <p className="mt-1 text-sm text-slate-500">
          Everything shown on the public homepage (before anyone logs in) — fully white-label, nothing hardcoded.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-400">Logo</h3>
        <div className="flex items-center gap-4">
          {settings.logo_url && (
            <img src={settings.logo_url} alt="" className="h-16 w-16 rounded-xl object-contain ring-1 ring-slate-200" />
          )}
          <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoFileChange} className="hidden" />
          <button
            type="button"
            onClick={() => logoInputRef.current?.click()}
            disabled={uploadingLogo}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {uploadingLogo ? "Uploading…" : settings.logo_url ? "Replace Logo" : "Upload Logo"}
          </button>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Hero Section</h3>
        <FL label="Headline">
          <input value={settings.hero_title} onChange={(e) => field("hero_title", e.target.value)} className={CLS_INPUT} />
        </FL>
        <FL label="Subheadline">
          <textarea value={settings.hero_subtitle} onChange={(e) => field("hero_subtitle", e.target.value)} rows={2} className={CLS_INPUT} />
        </FL>
        <FL label="Call-to-action button text">
          <input value={settings.hero_cta_label} onChange={(e) => field("hero_cta_label", e.target.value)} className={CLS_INPUT} />
        </FL>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">About Us</h3>
        <FL label="Section title">
          <input value={settings.about_title} onChange={(e) => field("about_title", e.target.value)} className={CLS_INPUT} />
        </FL>
        <FL label="Content">
          <RichTextEditor
            value={settings.about_content_html}
            onChange={(html) => field("about_content_html", html)}
            onImageUpload={uploadInlineImage}
            minHeight={220}
            resetKey={settings.id}
          />
        </FL>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Features</h3>
          <button
            type="button"
            onClick={handleAddFeature}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            + Add Feature
          </button>
        </div>
        {features.length === 0 && <p className="text-sm text-slate-400">No features added yet.</p>}
        <div className="space-y-3">
          {features.map((f, i) => (
            <FeatureRow
              key={f.id}
              feature={f}
              onSave={handleSaveFeature}
              onDelete={handleDeleteFeature}
              onMove={handleMoveFeature}
              isFirst={i === 0}
              isLast={i === features.length - 1}
            />
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Testimonials</h3>
          <button
            type="button"
            onClick={handleAddTestimonial}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            + Add Testimonial
          </button>
        </div>
        {testimonials.length === 0 && <p className="text-sm text-slate-400">No testimonials added yet.</p>}
        <div className="space-y-3">
          {testimonials.map((t) => (
            <TestimonialRow key={t.id} testimonial={t} onSave={handleSaveTestimonial} onDelete={handleDeleteTestimonial} />
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Pricing</h3>
        <p className="text-xs text-slate-400">
          The public Pricing section shows every <span className="font-semibold">active</span> plan from Admin → Billing &amp; Licensing → Plans, automatically — nothing to configure here.
        </p>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">WhatsApp Chat Button</h3>
        <p className="text-xs text-slate-400">Shown as a floating button on the homepage — clicking it opens a WhatsApp chat directly.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FL label="WhatsApp Number" hint="With country code, digits only — e.g. 919876543210">
            <input value={settings.whatsapp_number ?? ""} onChange={(e) => field("whatsapp_number", e.target.value)} placeholder="919876543210" className={CLS_INPUT} />
          </FL>
          <FL label="Default Message">
            <input value={settings.whatsapp_default_message} onChange={(e) => field("whatsapp_default_message", e.target.value)} className={CLS_INPUT} />
          </FL>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Contact &amp; Footer</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FL label="Contact Email">
            <input value={settings.contact_email ?? ""} onChange={(e) => field("contact_email", e.target.value)} className={CLS_INPUT} />
          </FL>
          <FL label="Contact Phone">
            <input value={settings.contact_phone ?? ""} onChange={(e) => field("contact_phone", e.target.value)} className={CLS_INPUT} />
          </FL>
          <FL label="Company Name (footer)">
            <input value={settings.footer_company_name ?? ""} onChange={(e) => field("footer_company_name", e.target.value)} className={CLS_INPUT} />
          </FL>
          <FL label="Tagline (footer)">
            <input value={settings.footer_tagline ?? ""} onChange={(e) => field("footer_tagline", e.target.value)} className={CLS_INPUT} />
          </FL>
          <FL label="Copyright Text">
            <input value={settings.footer_copyright_text ?? ""} onChange={(e) => field("footer_copyright_text", e.target.value)} placeholder="e.g. © 2026 Your Company. All rights reserved." className={CLS_INPUT} />
          </FL>
        </div>
      </section>

      {message && <div className="text-sm text-emerald-600">{message}</div>}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "💾 Save All Changes"}
      </button>

      <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Inquiries</h3>
          <p className="mt-1 text-xs text-slate-400">
            Trial requests and query-form submissions from the homepage — mark each one as you follow up. Nobody's account is created automatically; that's still up to you.
          </p>
        </div>
        {inquiries.length === 0 && <p className="text-sm text-slate-400">No inquiries yet.</p>}
        <div className="space-y-3">
          {inquiries.map((i) => (
            <InquiryRow key={i.id} inquiry={i} onStatusChange={handleInquiryStatusChange} />
          ))}
        </div>
      </section>
    </div>
  );
}
