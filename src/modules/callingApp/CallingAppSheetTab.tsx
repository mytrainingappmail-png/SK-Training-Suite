import { useMemo, useRef, useState } from "react";

import * as dataRepo from "../../repositories/callingApp/callingAppDataRepository";
import { buildSampleCsv, parseContactsCsv, exportContactsCsv, downloadCsvFile } from "../../services/callingApp/callingAppCsvService";
import type { CallingAppIdentity } from "./CallingAppShell";
import type { CallingAppContact, CallingAppDisposition, CallingAppCustomFieldDef, CallingAppAdmin } from "../../types/callingApp";

const INPUT_CLS = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30";

function CallDialog({
  identity,
  contact,
  dispositions,
  onClose,
  onDone,
}: {
  identity: CallingAppIdentity;
  contact: CallingAppContact;
  dispositions: CallingAppDisposition[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [dispositionId, setDispositionId] = useState(contact.disposition_id ?? "");
  const [remarks, setRemarks] = useState(contact.remarks ?? "");
  const [nextCallAt, setNextCallAt] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await dataRepo.logCall(
        identity.client,
        identity.admin.company_id,
        contact,
        identity.admin.id,
        dispositionId || null,
        remarks,
        nextCallAt ? new Date(nextCallAt).toISOString() : null
      );
      onDone();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const whatsappHref = `https://wa.me/${contact.mobile_no.replace(/\D/g, "")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-base font-bold text-slate-900">{contact.name}</h3>
        <p className="text-sm text-slate-500">{contact.mobile_no}{contact.project_name && ` · ${contact.project_name}`}</p>

        <div className="mt-4 flex gap-2">
          <a href={`tel:${contact.mobile_no}`} className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-emerald-700">
            📞 Call
          </a>
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-xl bg-[#25D366] px-4 py-2.5 text-center text-sm font-semibold text-white hover:opacity-90">
            💬 WhatsApp
          </a>
        </div>

        <div className="mt-5 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Disposition</label>
            <select value={dispositionId} onChange={(e) => setDispositionId(e.target.value)} className={`${INPUT_CLS} w-full`}>
              <option value="">— Select outcome —</option>
              {dispositions.filter((d) => d.is_active).map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Remarks</label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={`${INPUT_CLS} w-full`} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Next Call (optional)</label>
            <input type="datetime-local" value={nextCallAt} onChange={(e) => setNextCallAt(e.target.value)} className={`${INPUT_CLS} w-full`} />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {saving ? "Saving…" : "Log Call"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadModal({
  identity,
  fieldDefs,
  onClose,
  onDone,
  showToast,
}: {
  identity: CallingAppIdentity;
  fieldDefs: CallingAppCustomFieldDef[];
  onClose: () => void;
  onDone: () => void;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const [fileName, setFileName] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [rows, setRows] = useState<ReturnType<typeof parseContactsCsv>["rows"]>([]);
  const [listName, setListName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(file: File) {
    setFileName(file.name);
    setListName(file.name.replace(/\.csv$/i, ""));
    file.text().then((text) => {
      const result = parseContactsCsv(text, fieldDefs);
      setRows(result.rows);
      setErrors(result.errors);
    });
  }

  async function handleUpload() {
    if (rows.length === 0) return;
    setUploading(true);
    try {
      const list = await dataRepo.createCallList(identity.client, identity.admin.company_id, listName || fileName, rows.length, identity.admin.id);
      for (const r of rows) {
        const contact = await dataRepo.createContact(identity.client, identity.admin.company_id, list.id, r.form);
        for (const cfv of r.customFieldValues) {
          await dataRepo.upsertCustomFieldValue(identity.client, contact.id, cfv.field_def_id, cfv.value_text);
        }
      }
      showToast(`Uploaded ${rows.length} contacts.`);
      onDone();
      onClose();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Upload failed.", false);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-base font-bold text-slate-900">Upload Contacts (CSV)</h3>
        <button onClick={() => downloadSampleFor(fieldDefs)} className="mt-1 text-xs font-semibold text-indigo-600 hover:underline">
          Download sample CSV template
        </button>

        <div className="mt-4">
          <input ref={fileRef} type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="w-full text-sm" />
        </div>

        {fileName && (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-semibold text-slate-500">List Name</label>
            <input value={listName} onChange={(e) => setListName(e.target.value)} className={`${INPUT_CLS} w-full`} />
            <p className="mt-2 text-sm text-slate-600">{rows.length} valid row(s) found{errors.length > 0 && `, ${errors.length} skipped`}.</p>
            {errors.length > 0 && (
              <div className="mt-2 max-h-24 overflow-y-auto rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
                {errors.slice(0, 10).map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={handleUpload} disabled={uploading || rows.length === 0} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {uploading ? "Uploading…" : `Upload ${rows.length} Contacts`}
          </button>
        </div>
      </div>
    </div>
  );
}

function downloadSampleFor(fieldDefs: CallingAppCustomFieldDef[]) {
  downloadCsvFile("calling-app-sample.csv", buildSampleCsv(fieldDefs));
}

export function CallingAppSheetTab({
  identity,
  contacts,
  dispositions,
  fieldDefs,
  teamAdmins,
  onChanged,
  showToast,
}: {
  identity: CallingAppIdentity;
  contacts: CallingAppContact[];
  dispositions: CallingAppDisposition[];
  fieldDefs: CallingAppCustomFieldDef[];
  teamAdmins: CallingAppAdmin[];
  onChanged: () => void;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const { admin } = identity;
  const [search, setSearch] = useState("");
  const [dispositionFilter, setDispositionFilter] = useState("");
  const [viewMine, setViewMine] = useState(!admin.is_admin);
  const [callTarget, setCallTarget] = useState<CallingAppContact | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const dispositionById = useMemo(() => new Map(dispositions.map((d) => [d.id, d])), [dispositions]);
  const adminById = useMemo(() => new Map(teamAdmins.map((a) => [a.id, a])), [teamAdmins]);

  const filtered = useMemo(() => {
    return contacts.filter((c) => {
      if (viewMine && c.assigned_to !== admin.id) return false;
      if (dispositionFilter && c.disposition_id !== dispositionFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.mobile_no.includes(q)) return false;
      }
      return true;
    });
  }, [contacts, viewMine, admin.id, dispositionFilter, search]);

  async function handleAssign(contact: CallingAppContact, assignTo: string) {
    await dataRepo.updateContact(identity.client, contact.id, { assigned_to: assignTo || null });
    onChanged();
  }

  async function handleExport() {
    const values = await dataRepo.listCustomFieldValuesForContacts(identity.client, filtered.map((c) => c.id));
    const csv = exportContactsCsv(filtered, fieldDefs, values, dispositionById, adminById);
    downloadCsvFile("calling-app-export.csv", csv);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or mobile…" className={`${INPUT_CLS} w-full sm:flex-1 sm:min-w-[180px]`} />
        <div className="flex flex-wrap items-center gap-2">
          <select value={dispositionFilter} onChange={(e) => setDispositionFilter(e.target.value)} className={`${INPUT_CLS} flex-1 sm:flex-none`}>
            <option value="">All Dispositions</option>
            {dispositions.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          {admin.is_admin && (
            <label className="flex items-center gap-1.5 text-sm text-slate-600">
              <input type="checkbox" checked={viewMine} onChange={(e) => setViewMine(e.target.checked)} /> My contacts only
            </label>
          )}
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <button onClick={() => downloadSampleFor(fieldDefs)} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:flex-none">Sample CSV</button>
          {admin.can_download && (
            <button onClick={handleExport} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:flex-none">
              Export CSV
            </button>
          )}
          {admin.can_upload && (
            <button onClick={() => setUploadOpen(true)} className="flex-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 sm:flex-none">
              + Upload CSV
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-400 shadow-sm">
          No contacts match. {admin.can_upload && "Upload a CSV to get started."}
        </div>
      )}

      {/* Mobile: stacked cards — a 7-column table doesn't fit a phone screen,
          and this is the tab telecallers use most while out and about. */}
      <div className="space-y-3 md:hidden">
        {filtered.map((c) => {
          const disp = c.disposition_id ? dispositionById.get(c.disposition_id) : null;
          return (
            <div key={c.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{c.name}</p>
                  <p className="text-sm text-slate-500">{c.mobile_no}</p>
                  {c.project_name && <p className="text-xs text-slate-400">{c.project_name}</p>}
                </div>
                {disp ? (
                  <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: `${disp.color}22`, color: disp.color }}>{disp.label}</span>
                ) : <span className="shrink-0 text-xs text-slate-400">Not called</span>}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>Attempts: {c.attempt_count}</span>
                <span>Next call: {c.next_call_at ? new Date(c.next_call_at).toLocaleDateString() : "—"}</span>
              </div>

              {admin.is_admin && (
                <select value={c.assigned_to ?? ""} onChange={(e) => handleAssign(c, e.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">
                  <option value="">Unassigned</option>
                  {teamAdmins.map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
                </select>
              )}

              <button onClick={() => setCallTarget(c)} className="mt-3 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
                📞 Call & Log
              </button>
            </div>
          );
        })}
      </div>

      {/* Desktop/tablet: full table. */}
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Mobile</th>
              <th className="px-4 py-3">Disposition</th>
              {admin.is_admin && <th className="px-4 py-3">Assigned To</th>}
              <th className="px-4 py-3">Attempts</th>
              <th className="px-4 py-3">Next Call</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const disp = c.disposition_id ? dispositionById.get(c.disposition_id) : null;
              return (
                <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{c.name}{c.project_name && <div className="text-xs text-slate-400">{c.project_name}</div>}</td>
                  <td className="px-4 py-3 text-slate-600">{c.mobile_no}</td>
                  <td className="px-4 py-3">
                    {disp ? (
                      <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: `${disp.color}22`, color: disp.color }}>{disp.label}</span>
                    ) : <span className="text-xs text-slate-400">Not called</span>}
                  </td>
                  {admin.is_admin && (
                    <td className="px-4 py-3">
                      <select value={c.assigned_to ?? ""} onChange={(e) => handleAssign(c, e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
                        <option value="">Unassigned</option>
                        {teamAdmins.map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
                      </select>
                    </td>
                  )}
                  <td className="px-4 py-3 text-slate-500">{c.attempt_count}</td>
                  <td className="px-4 py-3 text-slate-500">{c.next_call_at ? new Date(c.next_call_at).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setCallTarget(c)} className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100">Call & Log</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {callTarget && (
        <CallDialog identity={identity} contact={callTarget} dispositions={dispositions} onClose={() => setCallTarget(null)} onDone={onChanged} />
      )}
      {uploadOpen && (
        <UploadModal identity={identity} fieldDefs={fieldDefs} onClose={() => setUploadOpen(false)} onDone={onChanged} showToast={showToast} />
      )}
    </div>
  );
}
