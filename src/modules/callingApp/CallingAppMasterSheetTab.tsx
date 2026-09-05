import { useEffect, useRef, useState } from "react";

import * as dataRepo from "../../repositories/callingApp/callingAppDataRepository";
import { parseContactsCsv, downloadCsvFile, buildSampleCsv } from "../../services/callingApp/callingAppCsvService";
import type { CallingAppIdentity } from "./CallingAppShell";
import type { CallingAppCallList, CallingAppContact, CallingAppCustomFieldDef, CallingAppAdmin, MasterSheetListSummary, DuplicateContactGroup, CallingAppSettings, CallingAppBatchPerformance } from "../../types/callingApp";

const INPUT_CLS = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30";

function DuplicatesPanel({
  identity,
  teamAdmins,
  onDone,
  showToast,
}: {
  identity: CallingAppIdentity;
  teamAdmins: CallingAppAdmin[];
  onDone: () => void;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const [groups, setGroups] = useState<DuplicateContactGroup[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const adminById = new Map(teamAdmins.map((a) => [a.id, a]));

  async function scan() {
    setLoading(true);
    try {
      const found = await dataRepo.findDuplicateGroups(identity.client, identity.admin.company_id);
      setGroups(found);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveOne(contactId: string) {
    await dataRepo.deleteContact(identity.client, contactId);
    await scan();
    onDone();
  }

  async function handleCleanAll() {
    if (!groups || groups.length === 0) return;
    const extraCount = groups.reduce((sum, g) => sum + g.entries.length - 1, 0);
    if (!window.confirm(`Remove ${extraCount} duplicate contact(s)? The oldest entry in each group is always kept.`)) return;
    setCleaning(true);
    try {
      const removed = await dataRepo.removeDuplicateContacts(identity.client, groups);
      showToast(`Removed ${removed} duplicate contact(s).`);
      await scan();
      onDone();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not remove duplicates.", false);
    } finally {
      setCleaning(false);
    }
  }

  const extraCount = groups ? groups.reduce((sum, g) => sum + g.entries.length - 1, 0) : 0;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Find & Remove Duplicates</h3>
          <p className="mt-1 text-xs text-slate-600">Same mobile number uploaded more than once — review before removing, or clean them all in one go.</p>
        </div>
        <button onClick={scan} disabled={loading} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
          {loading ? "Scanning…" : groups === null ? "Scan for Duplicates" : "Rescan"}
        </button>
      </div>

      {groups !== null && (
        <div className="mt-4">
          {groups.length === 0 ? (
            <p className="text-sm text-emerald-600">✅ No duplicate mobile numbers found.</p>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm text-amber-700">{groups.length} number(s) duplicated, {extraCount} extra row(s) total.</p>
                <button onClick={handleCleanAll} disabled={cleaning} className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50">
                  {cleaning ? "Cleaning…" : `Remove All ${extraCount} Extras (keep oldest)`}
                </button>
              </div>
              <div className="max-h-80 space-y-3 overflow-y-auto">
                {groups.map((g) => (
                  <div key={g.mobile_no} className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-800">{g.mobile_no} — {g.entries.length} entries</p>
                    <div className="mt-2 space-y-1">
                      {g.entries.map((c, i) => (
                        <div key={c.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 text-xs">
                          <span>
                            {c.name} {i === 0 && <span className="ml-1 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Keep (oldest)</span>}
                            {c.assigned_to && <span className="ml-1 text-slate-600">· assigned to {adminById.get(c.assigned_to)?.display_name ?? "someone"}</span>}
                          </span>
                          {i > 0 && (
                            <button onClick={() => handleRemoveOne(c.id)} className="font-semibold text-red-500 hover:underline">Remove</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function UploadToMasterSheet({
  identity,
  fieldDefs,
  onDone,
  showToast,
}: {
  identity: CallingAppIdentity;
  fieldDefs: CallingAppCustomFieldDef[];
  onDone: () => void;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
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
      // No assigned_to — this is exactly what makes it land in the Master
      // Sheet pool rather than any one employee's sheet. No row-count
      // limit either; every parsed row is inserted.
      const list = await dataRepo.createCallList(identity.client, identity.admin.company_id, listName || fileName, rowsToImport.length, identity.admin.id);
      for (const r of rowsToImport) {
        const contact = await dataRepo.createContact(identity.client, identity.admin.company_id, list.id, r.form);
        for (const cfv of r.customFieldValues) {
          await dataRepo.upsertCustomFieldValue(identity.client, contact.id, cfv.field_def_id, cfv.value_text);
        }
      }
      showToast(`${rowsToImport.length} contacts added to the Master Sheet.`);
      setOpen(false);
      setFileName("");
      setRows([]);
      setDuplicates(new Map());
      onDone();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Upload failed.", false);
    } finally {
      setUploading(false);
    }
  }

  if (!open) {
    return (
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setOpen(true)} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
          + Upload to Master Sheet
        </button>
        <button onClick={() => downloadCsvFile("calling-app-sample.csv", buildSampleCsv(fieldDefs))} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          Sample CSV
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">Upload to Master Sheet</h3>
      <p className="mt-1 text-xs text-slate-600">These contacts land in the shared pool, unassigned — distribute them to one or more employees below whenever you're ready. No limit on how many you can upload.</p>

      <input ref={fileRef} type="file" accept=".csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="mt-3 w-full text-sm" />

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
              <p className="text-xs font-semibold text-amber-800">⚠ {duplicates.size} number(s) already exist — this is a repeat lead.</p>
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

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
        <button onClick={handleUpload} disabled={uploading || rowsToImport.length === 0} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
          {uploading ? "Uploading…" : `Add ${rowsToImport.length} to Master Sheet`}
        </button>
      </div>
    </div>
  );
}

function AutoDistributePanel({
  identity,
  showToast,
}: {
  identity: CallingAppIdentity;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const [settings, setSettings] = useState<CallingAppSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    dataRepo.getSettings(identity.client, identity.admin.company_id).then(setSettings);
  }, [identity.client, identity.admin.company_id]);

  async function toggle(next: boolean) {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await dataRepo.saveSettings(identity.client, identity.admin.company_id, { auto_distribute_enabled: next });
      setSettings(updated);
      showToast(next ? "Auto-distribution turned ON." : "Auto-distribution turned off.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not save.", false);
    } finally {
      setSaving(false);
    }
  }

  async function saveBatchSize(next: number) {
    if (!settings || next <= 0) return;
    setSaving(true);
    try {
      const updated = await dataRepo.saveSettings(identity.client, identity.admin.company_id, { auto_distribute_batch_size: next });
      setSettings(updated);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not save.", false);
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return null;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">⚡ Auto-Distribution</h3>
          <p className="mt-1 text-xs text-slate-600">
            When ON, the moment an employee finishes every lead they were given, they're topped up automatically from the Master Sheet — no need to distribute by hand each time.
            If the pool runs low or empty, you'll be notified here instead.
          </p>
        </div>
        <button
          type="button"
          onClick={() => toggle(!settings.auto_distribute_enabled)}
          disabled={saving}
          className={`relative h-7 w-14 shrink-0 rounded-full transition ${settings.auto_distribute_enabled ? "bg-emerald-500" : "bg-slate-300"} disabled:opacity-50`}
        >
          <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${settings.auto_distribute_enabled ? "left-8" : "left-1"}`} />
        </button>
      </div>

      {settings.auto_distribute_enabled && (
        <div className="mt-4 flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Top-up batch size (per employee)</label>
          <input
            type="number"
            min={1}
            defaultValue={settings.auto_distribute_batch_size}
            onBlur={(e) => saveBatchSize(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className={`${INPUT_CLS} w-24`}
          />
        </div>
      )}
    </div>
  );
}

function RecallPanel({
  identity,
  teamAdmins,
  contacts,
  onDone,
  showToast,
}: {
  identity: CallingAppIdentity;
  teamAdmins: CallingAppAdmin[];
  contacts: CallingAppContact[];
  onDone: () => void;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const [adminId, setAdminId] = useState("");
  const [recalling, setRecalling] = useState(false);

  const mine = contacts.filter((c) => c.assigned_to === adminId);
  const pending = mine.filter((c) => c.attempt_count === 0).length;
  const worked = mine.length - pending;

  async function handleRecall(onlyUnworked: boolean) {
    if (!adminId) return;
    const label = teamAdmins.find((a) => a.id === adminId)?.display_name ?? "this employee";
    const scopeLabel = onlyUnworked ? `their ${pending} never-called lead(s)` : `ALL ${mine.length} lead(s) currently assigned to them (including already-worked ones)`;
    if (!window.confirm(`Recall ${scopeLabel} from ${label} back to the Master Sheet pool?`)) return;
    setRecalling(true);
    try {
      const count = await dataRepo.recallContacts(identity.client, adminId, onlyUnworked);
      showToast(`Recalled ${count} contact(s) from ${label}.`);
      onDone();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Recall failed.", false);
    } finally {
      setRecalling(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">↩ Recall Data</h3>
      <p className="mt-1 text-xs text-slate-600">Pull leads back from an employee into the unassigned pool — e.g. they've left, or are sitting on more than they can work through.</p>

      <div className="mt-3">
        <select value={adminId} onChange={(e) => setAdminId(e.target.value)} className={`${INPUT_CLS} w-full sm:w-64`}>
          <option value="">— Select employee —</option>
          {teamAdmins.map((a) => <option key={a.id} value={a.id}>{a.display_name}</option>)}
        </select>
      </div>

      {adminId && (
        <>
          <p className="mt-3 text-sm text-slate-700">
            {mine.length} total assigned · <span className="font-semibold text-amber-600">{pending} never called</span> · {worked} already worked
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => handleRecall(true)}
              disabled={recalling || pending === 0}
              className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-40"
            >
              Recall {pending} Never-Called
            </button>
            <button
              onClick={() => handleRecall(false)}
              disabled={recalling || mine.length === 0}
              className="rounded-xl border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              Recall ALL {mine.length} (including worked)
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function BatchPerformancePanel({
  identity,
  teamAdmins,
}: {
  identity: CallingAppIdentity;
  teamAdmins: CallingAppAdmin[];
}) {
  const [batches, setBatches] = useState<CallingAppBatchPerformance[] | null>(null);
  const adminById = new Map(teamAdmins.map((a) => [a.id, a]));

  useEffect(() => {
    dataRepo.listBatchPerformance(identity.client, identity.admin.company_id).then(setBatches);
  }, [identity.client, identity.admin.company_id]);

  function formatDuration(fromIso: string, toIso: string): string {
    const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
    if (ms < 0) return "—";
    const hours = ms / 3_600_000;
    if (hours < 1) return `${Math.max(1, Math.round(ms / 60_000))} min`;
    if (hours < 48) return `${hours.toFixed(1)} hrs`;
    return `${(hours / 24).toFixed(1)} days`;
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="mb-1 text-sm font-bold text-slate-900">⏱ Batch Completion Time</h3>
      <p className="mb-3 text-xs text-slate-600">Every batch an employee was given (manual or automatic), and how long it took them to work through it — a direct read on pace.</p>
      {!batches ? (
        <p className="text-xs text-slate-600">Loading…</p>
      ) : batches.length === 0 ? (
        <p className="text-xs text-slate-600">No batches distributed yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Given On</th>
                <th className="px-3 py-2 text-right">Batch Size</th>
                <th className="px-3 py-2 text-right">Worked</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Time Taken</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={`${b.admin_id}-${b.assigned_at}`} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2 font-medium text-slate-800">{adminById.get(b.admin_id)?.display_name ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-600">{new Date(b.assigned_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{b.batch_size}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{b.worked_count}</td>
                  <td className="px-3 py-2">
                    {b.is_complete ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">Complete</span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">In Progress</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-semibold text-indigo-700">
                    {b.is_complete && b.first_worked_at && b.last_worked_at ? formatDuration(b.assigned_at, b.last_worked_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DistributePanel({
  identity,
  lists,
  teamAdmins,
  onDone,
  showToast,
}: {
  identity: CallingAppIdentity;
  lists: CallingAppCallList[];
  teamAdmins: CallingAppAdmin[];
  onDone: () => void;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const [listId, setListId] = useState("");
  const [selectedAdmins, setSelectedAdmins] = useState<Set<string>>(new Set());
  const [perEmployee, setPerEmployee] = useState(50);
  const [distributing, setDistributing] = useState(false);
  const [poolCount, setPoolCount] = useState<number | null>(null);

  useEffect(() => {
    dataRepo.getUnassignedContacts(identity.client, identity.admin.company_id, listId || undefined).then((c) => setPoolCount(c.length));
  }, [identity.client, identity.admin.company_id, listId]);

  function toggleAdmin(id: string) {
    setSelectedAdmins((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDistribute() {
    if (selectedAdmins.size === 0 || perEmployee <= 0) return;
    setDistributing(true);
    try {
      // Sequential: pull a fresh batch of `perEmployee` oldest-unassigned
      // contacts for EACH selected employee in turn, so the same contact
      // is never handed to two people in one distribution.
      let totalGiven = 0;
      for (const adminId of selectedAdmins) {
        const batch = await dataRepo.getUnassignedContacts(identity.client, identity.admin.company_id, listId || undefined, perEmployee);
        if (batch.length === 0) break;
        await dataRepo.distributeContacts(identity.client, batch.map((c) => c.id), adminId, identity.admin.id, identity.admin.company_id);
        totalGiven += batch.length;
      }
      showToast(`Distributed ${totalGiven} contacts across ${selectedAdmins.size} employee(s).`);
      setSelectedAdmins(new Set());
      onDone();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Distribution failed.", false);
    } finally {
      setDistributing(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-bold text-slate-900">Distribute Data</h3>
      <p className="mt-1 text-xs text-slate-600">Give the next batch of unassigned contacts to one or more employees — no need to upload a fresh file each time.</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">From</label>
          <select value={listId} onChange={(e) => setListId(e.target.value)} className={`${INPUT_CLS} w-full`}>
            <option value="">Any list (oldest unassigned first)</option>
            {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-600">{poolCount === null ? "…" : `${poolCount} unassigned available`}</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Contacts per employee</label>
          <input type="number" min={1} value={perEmployee} onChange={(e) => setPerEmployee(Math.max(1, parseInt(e.target.value, 10) || 1))} className={`${INPUT_CLS} w-full`} />
        </div>
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-xs font-semibold text-slate-600">Give to (select one or more)</label>
        <div className="flex flex-wrap gap-2">
          {teamAdmins.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => toggleAdmin(a.id)}
              className={`rounded-full border-2 px-3 py-1.5 text-xs font-semibold ${selectedAdmins.has(a.id) ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600"}`}
            >
              {a.display_name}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleDistribute}
        disabled={distributing || selectedAdmins.size === 0}
        className="mt-4 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 sm:w-auto sm:px-6"
      >
        {distributing ? "Distributing…" : `Distribute to ${selectedAdmins.size || 0} Employee(s)`}
      </button>
    </div>
  );
}

export function CallingAppMasterSheetTab({
  identity,
  contacts,
  fieldDefs,
  teamAdmins,
  onChanged,
  showToast,
}: {
  identity: CallingAppIdentity;
  contacts: CallingAppContact[];
  fieldDefs: CallingAppCustomFieldDef[];
  teamAdmins: CallingAppAdmin[];
  onChanged: () => void;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const [lists, setLists] = useState<CallingAppCallList[]>([]);

  useEffect(() => {
    dataRepo.listCallLists(identity.client, identity.admin.company_id).then(setLists);
  }, [identity.client, identity.admin.company_id]);

  const listSummaries: MasterSheetListSummary[] = dataRepo.buildMasterSheetSummary(lists, contacts);
  const distribution = dataRepo.buildEmployeeDistributionSummary(teamAdmins, contacts);

  function refresh() {
    dataRepo.listCallLists(identity.client, identity.admin.company_id).then(setLists);
    onChanged();
  }

  return (
    <div className="space-y-6">
      <UploadToMasterSheet identity={identity} fieldDefs={fieldDefs} onDone={refresh} showToast={showToast} />

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-bold text-slate-900">Lists in the Master Sheet</h3>
        {listSummaries.length === 0 ? (
          <p className="text-xs text-slate-600">No lists uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {listSummaries.map((s) => (
              <div key={s.list.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm">
                <span className="font-medium text-slate-800">{s.list.name}</span>
                <span className="text-xs text-slate-600">{s.total} total · {s.assigned} distributed · <span className="font-semibold text-indigo-600">{s.unassigned} remaining</span></span>
              </div>
            ))}
          </div>
        )}
      </div>

      <AutoDistributePanel identity={identity} showToast={showToast} />

      <DistributePanel identity={identity} lists={lists} teamAdmins={teamAdmins} onDone={refresh} showToast={showToast} />

      <RecallPanel identity={identity} teamAdmins={teamAdmins} contacts={contacts} onDone={onChanged} showToast={showToast} />

      <DuplicatesPanel identity={identity} teamAdmins={teamAdmins} onDone={refresh} showToast={showToast} />

      <BatchPerformancePanel identity={identity} teamAdmins={teamAdmins} />

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-bold text-slate-900">Who Has Been Given How Much</h3>
        <p className="mb-3 text-xs text-slate-600">So you always know who's running low before they ask.</p>
        {distribution.length === 0 ? (
          <p className="text-xs text-slate-600">Nobody has been given any data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-600">
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2 text-right">Total Given</th>
                  <th className="px-3 py-2 text-right">Still Pending</th>
                  <th className="px-3 py-2">First Given</th>
                  <th className="px-3 py-2">Last Given</th>
                </tr>
              </thead>
              <tbody>
                {distribution.map((d) => (
                  <tr key={d.admin.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-2 font-medium text-slate-800">{d.admin.display_name}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{d.totalAssigned}</td>
                    <td className="px-3 py-2 text-right font-semibold text-amber-600">{d.pending}</td>
                    <td className="px-3 py-2 text-slate-600">{d.firstAssignedAt ? new Date(d.firstAssignedAt).toLocaleDateString() : "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{d.lastAssignedAt ? new Date(d.lastAssignedAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
