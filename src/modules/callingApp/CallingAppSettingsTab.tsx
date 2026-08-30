import { useState } from "react";

import * as dataRepo from "../../repositories/callingApp/callingAppDataRepository";
import type { CallingAppIdentity } from "./CallingAppShell";
import type { CallingAppDisposition, CallingAppCustomFieldDef, DispositionOutcome, CustomFieldType } from "../../types/callingApp";

const INPUT_CLS = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30";

const OUTCOME_OPTIONS: { value: DispositionOutcome; label: string }[] = [
  { value: "positive", label: "Positive" },
  { value: "neutral", label: "Neutral" },
  { value: "negative", label: "Negative" },
];

function DispositionsPanel({ identity, dispositions, onChanged }: { identity: CallingAppIdentity; dispositions: CallingAppDisposition[]; onChanged: () => void }) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [outcome, setOutcome] = useState<DispositionOutcome>("neutral");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!label.trim()) return;
    setSaving(true);
    try {
      await dataRepo.createDisposition(identity.client, identity.admin.company_id, { label: label.trim(), color, outcome_type: outcome, sort_order: dispositions.length });
      setLabel("");
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await dataRepo.deleteDisposition(identity.client, id);
    onChanged();
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Dispositions</h3>
      <p className="text-xs text-slate-400">Call outcomes your team picks from. Tag each Positive/Neutral/Negative — this drives the Reports quality score.</p>

      <div className="space-y-2">
        {dispositions.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="text-sm font-medium text-slate-800">{d.label}</span>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-500">{d.outcome_type}</span>
            </div>
            <button onClick={() => handleDelete(d.id)} className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Interested" className={`${INPUT_CLS} flex-1 min-w-[140px]`} />
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-12 rounded-lg border border-slate-200" />
        <select value={outcome} onChange={(e) => setOutcome(e.target.value as DispositionOutcome)} className={INPUT_CLS}>
          {OUTCOME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={handleAdd} disabled={saving} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          + Add
        </button>
      </div>
    </section>
  );
}

function CustomFieldsPanel({ identity, fieldDefs, onChanged }: { identity: CallingAppIdentity; fieldDefs: CallingAppCustomFieldDef[]; onChanged: () => void }) {
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldType>("text");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!label.trim()) return;
    setSaving(true);
    try {
      const fieldKey = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
      await dataRepo.createCustomFieldDef(identity.client, identity.admin.company_id, {
        field_key: fieldKey,
        label: label.trim(),
        field_type: fieldType,
        dropdown_options: null,
        sort_order: fieldDefs.length,
      });
      setLabel("");
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await dataRepo.deleteCustomFieldDef(identity.client, id);
    onChanged();
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Custom Fields</h3>
      <p className="text-xs text-slate-400">Extra columns on your calling sheet — e.g. "Budget", "Preferred Location". Shows up in CSV upload/download automatically.</p>

      <div className="space-y-2">
        {fieldDefs.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5">
            <span className="text-sm font-medium text-slate-800">{f.label} <span className="text-xs text-slate-400">({f.field_type})</span></span>
            <button onClick={() => handleDelete(f.id)} className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Budget" className={`${INPUT_CLS} flex-1 min-w-[140px]`} />
        <select value={fieldType} onChange={(e) => setFieldType(e.target.value as CustomFieldType)} className={INPUT_CLS}>
          <option value="text">Text</option>
          <option value="number">Number</option>
          <option value="date">Date</option>
        </select>
        <button onClick={handleAdd} disabled={saving} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          + Add
        </button>
      </div>
    </section>
  );
}

export function CallingAppSettingsTab({
  identity,
  dispositions,
  fieldDefs,
  onChanged,
}: {
  identity: CallingAppIdentity;
  dispositions: CallingAppDisposition[];
  fieldDefs: CallingAppCustomFieldDef[];
  onChanged: () => void;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  return (
    <div className="space-y-6">
      <DispositionsPanel identity={identity} dispositions={dispositions} onChanged={onChanged} />
      <CustomFieldsPanel identity={identity} fieldDefs={fieldDefs} onChanged={onChanged} />
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-xs text-slate-500">
        To add/remove who has Calling App access, or change someone's Admin/Upload/Download permissions, go to the main app's <span className="font-semibold">Admin → Calling App</span> tab.
      </div>
    </div>
  );
}
