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
  teamAdmins,
  onClose,
  onDone,
  showToast,
}: {
  identity: CallingAppIdentity;
  contact: CallingAppContact;
  dispositions: CallingAppDisposition[];
  teamAdmins: CallingAppAdmin[];
  onClose: () => void;
  onDone: () => void;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const [dispositionId, setDispositionId] = useState(contact.disposition_id ?? "");
  const [remarks, setRemarks] = useState(contact.remarks ?? "");
  const [nextCallAt, setNextCallAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [isProspect, setIsProspect] = useState(contact.is_prospect);
  const [savingProspect, setSavingProspect] = useState(false);
  const [handoffTo, setHandoffTo] = useState("");
  const [handoffNote, setHandoffNote] = useState("");
  const [sendingHandoff, setSendingHandoff] = useState(false);

  const iOwnThisContact = contact.assigned_to === identity.admin.id;

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

  async function handleToggleProspect(next: boolean) {
    setIsProspect(next);
    setSavingProspect(true);
    try {
      await dataRepo.markProspect(identity.client, contact.id, next);
      onDone();
    } catch (e) {
      setIsProspect(!next);
      showToast(e instanceof Error ? e.message : "Could not update prospect status.", false);
    } finally {
      setSavingProspect(false);
    }
  }

  async function handleRequestHandoff() {
    if (!handoffTo) return;
    setSendingHandoff(true);
    try {
      await dataRepo.createHandoff(identity.client, identity.admin.company_id, contact.id, identity.admin.id, handoffTo, handoffNote);
      showToast("Handoff request sent — check the Prospects tab for its status.");
      setHandoffTo("");
      setHandoffNote("");
      onDone();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not send the handoff request.", false);
    } finally {
      setSendingHandoff(false);
    }
  }

  const whatsappHref = `https://wa.me/${contact.mobile_no.replace(/\D/g, "")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-base font-bold text-slate-900">{contact.name}</h3>
        <p className="text-sm text-slate-600">{contact.mobile_no}{contact.project_name && ` · ${contact.project_name}`}</p>

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
            <label className="mb-1 block text-xs font-semibold text-slate-600">Disposition</label>
            <select value={dispositionId} onChange={(e) => setDispositionId(e.target.value)} className={`${INPUT_CLS} w-full`}>
              <option value="">— Select outcome —</option>
              {dispositions.filter((d) => d.is_active).map((d) => (
                <option key={d.id} value={d.id}>{d.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Remarks</label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={`${INPUT_CLS} w-full`} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Next Call (optional)</label>
            <input type="datetime-local" value={nextCallAt} onChange={(e) => setNextCallAt(e.target.value)} className={`${INPUT_CLS} w-full`} />
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
          <input type="checkbox" checked={isProspect} disabled={savingProspect} onChange={(e) => handleToggleProspect(e.target.checked)} />
          🎯 Mark as Prospect
        </label>

        {iOwnThisContact && teamAdmins.length > 1 && (
          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-600">Hand off this contact</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <select value={handoffTo} onChange={(e) => setHandoffTo(e.target.value)} className={`${INPUT_CLS} flex-1 min-w-[140px]`}>
                <option value="">— Select recipient —</option>
                {teamAdmins.filter((a) => a.id !== identity.admin.id).map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
              </select>
            </div>
            <input value={handoffNote} onChange={(e) => setHandoffNote(e.target.value)} placeholder="Note (optional)" className={`${INPUT_CLS} mt-2 w-full`} />
            <button onClick={handleRequestHandoff} disabled={!handoffTo || sendingHandoff} className="mt-2 w-full rounded-lg bg-slate-700 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
              {sendingHandoff ? "Sending…" : "Request Handoff"}
            </button>
          </div>
        )}

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
  const [duplicates, setDuplicates] = useState<Map<string, string>>(new Map());
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [listName, setListName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function onFile(file: File) {
    setFileName(file.name);
    setListName(file.name.replace(/\.csv$/i, ""));
    file.text().then(async (text) => {
      const result = parseContactsCsv(text, fieldDefs);
      setRows(result.rows);
      setErrors(result.errors);

      const matches = await dataRepo.findDuplicateMobiles(identity.client, identity.admin.company_id, result.rows.map((r) => r.form.mobile_no));
      setDuplicates(new Map(matches.map((m) => [m.mobile_no, m.existingName])));
    });
  }

  const rowsToImport = skipDuplicates ? rows.filter((r) => !duplicates.has(r.form.mobile_no)) : rows;

  async function handleUpload() {
    if (rowsToImport.length === 0) return;
    setUploading(true);
    try {
      const list = await dataRepo.createCallList(identity.client, identity.admin.company_id, listName || fileName, rowsToImport.length, identity.admin.id);
      for (const r of rowsToImport) {
        const contact = await dataRepo.createContact(identity.client, identity.admin.company_id, list.id, r.form);
        for (const cfv of r.customFieldValues) {
          await dataRepo.upsertCustomFieldValue(identity.client, contact.id, cfv.field_def_id, cfv.value_text);
        }
      }
      showToast(`Uploaded ${rowsToImport.length} contacts.`);
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
            <label className="mb-1 block text-xs font-semibold text-slate-600">List Name</label>
            <input value={listName} onChange={(e) => setListName(e.target.value)} className={`${INPUT_CLS} w-full`} />
            <p className="mt-2 text-sm text-slate-600">{rows.length} valid row(s) found{errors.length > 0 && `, ${errors.length} skipped`}.</p>
            {errors.length > 0 && (
              <div className="mt-2 max-h-24 overflow-y-auto rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
                {errors.slice(0, 10).map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
            {duplicates.size > 0 && (
              <div className="mt-2 rounded-lg bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-800">⚠ {duplicates.size} number(s) already exist in your Calling App — this is a repeat lead.</p>
                <div className="mt-1 max-h-20 overflow-y-auto text-xs text-amber-700">
                  {Array.from(duplicates.entries()).slice(0, 8).map(([mobile, name]) => <p key={mobile}>{mobile} — already have "{name}"</p>)}
                </div>
                <label className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-800">
                  <input type="checkbox" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} /> Skip duplicates (recommended)
                </label>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={handleUpload} disabled={uploading || rowsToImport.length === 0} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
            {uploading ? "Uploading…" : `Upload ${rowsToImport.length} Contacts`}
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
        <div className="rounded-2xl border border-slate-100 bg-white px-4 py-10 text-center text-sm text-slate-600 shadow-sm">
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
                  <p className="font-semibold text-slate-800">{c.name} {c.is_prospect && <span title="Prospect">🎯</span>}</p>
                  <p className="text-sm text-slate-600">{c.mobile_no}</p>
                  {c.project_name && <p className="text-xs text-slate-600">{c.project_name}</p>}
                </div>
                {disp ? (
                  <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: `${disp.color}22`, color: disp.color }}>{disp.label}</span>
                ) : <span className="shrink-0 text-xs text-slate-600">Not called</span>}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
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
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
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
                  <td className="px-4 py-3 font-medium text-slate-800">{c.name} {c.is_prospect && <span title="Prospect">🎯</span>}{c.project_name && <div className="text-xs text-slate-600">{c.project_name}</div>}</td>
                  <td className="px-4 py-3 text-slate-600">{c.mobile_no}</td>
                  <td className="px-4 py-3">
                    {disp ? (
                      <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ backgroundColor: `${disp.color}22`, color: disp.color }}>{disp.label}</span>
                    ) : <span className="text-xs text-slate-600">Not called</span>}
                  </td>
                  {admin.is_admin && (
                    <td className="px-4 py-3">
                      <select value={c.assigned_to ?? ""} onChange={(e) => handleAssign(c, e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs">
                        <option value="">Unassigned</option>
                        {teamAdmins.map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
                      </select>
                    </td>
                  )}
                  <td className="px-4 py-3 text-slate-600">{c.attempt_count}</td>
                  <td className="px-4 py-3 text-slate-600">{c.next_call_at ? new Date(c.next_call_at).toLocaleDateString() : "—"}</td>
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
        <CallDialog identity={identity} contact={callTarget} dispositions={dispositions} teamAdmins={teamAdmins} onClose={() => setCallTarget(null)} onDone={onChanged} showToast={showToast} />
      )}
      {uploadOpen && (
        <UploadModal identity={identity} fieldDefs={fieldDefs} onClose={() => setUploadOpen(false)} onDone={onChanged} showToast={showToast} />
      )}
    </div>
  );
}
