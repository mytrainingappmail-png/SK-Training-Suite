// Admin picks the winner — informed by the existing Reports page
// (attendance %, average score, completion rate) rather than a hidden
// auto-computed formula, so the recognition feels fair and accounts for
// whatever the admin actually weighs (discipline, punctuality, results).

import { useEffect, useRef, useState } from 'react';
import { loadAll, saveEntry, editEntry, removeEntry } from '../../../services/employeeOfTheMonth/employeeOfTheMonthService';
import { uploadImage } from '../../../services/contentEditor/contentEditorService';
import { employeeService } from '../../../services/employee/employeeService';
import type { EmployeeOfTheMonth, EmployeeOfTheMonthForm } from '../../../types/employeeOfTheMonth';
import { MONTH_NAMES } from '../../../types/employeeOfTheMonth';
import type { Employee } from '../../../types/employee';

const INPUT_CLS = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';
const now = new Date();

function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}

function EmployeeOfTheMonthManagement() {
  const [entries, setEntries] = useState<EmployeeOfTheMonth[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EmployeeOfTheMonthForm>({ employee_id: '', month: now.getMonth() + 1, year: now.getFullYear(), photo_url: '', message: '' });
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    Promise.all([loadAll(), employeeService.getAll()])
      .then(([e, emp]) => { setEntries(e); setEmployees(emp); })
      .catch((err: unknown) => showToast(err instanceof Error ? err.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchAll(); }, []);

  function employeeName(id: string): string {
    const e = employees.find((emp) => emp.id === id);
    return e ? `${e.first_name} ${e.last_name}` : '—';
  }

  function startNew() {
    setEditingId('new');
    setDraft({ employee_id: employees[0]?.id ?? '', month: now.getMonth() + 1, year: now.getFullYear(), photo_url: '', message: '' });
  }

  function startEdit(entry: EmployeeOfTheMonth) {
    setEditingId(entry.id);
    setDraft({ employee_id: entry.employee_id, month: entry.month, year: entry.year, photo_url: entry.photo_url, message: entry.message });
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const { url } = await uploadImage(file);
      setDraft((d) => ({ ...d, photo_url: url }));
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingId === 'new') {
        await saveEntry(draft);
      } else if (editingId) {
        await editEntry(editingId, draft);
      }
      setEditingId(null);
      fetchAll();
      showToast('Saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save — is there already a winner for this month?');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await removeEntry(id);
      fetchAll();
      showToast('Removed');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete.');
    }
  }

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Employee of the Month</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pick the winner based on Reports (attendance, scores, completion) — then add their photo and a message. Shown on every employee's Dashboard.
        </p>
      </div>

      {editingId ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-bold text-slate-900">{editingId === 'new' ? 'New Winner' : 'Edit Winner'}</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Employee</label>
              <select value={draft.employee_id} onChange={(e) => setDraft((d) => ({ ...d, employee_id: e.target.value }))} className={INPUT_CLS}>
                <option value="">— Select —</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_code})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Month</label>
                <select value={draft.month} onChange={(e) => setDraft((d) => ({ ...d, month: Number(e.target.value) }))} className={INPUT_CLS}>
                  {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Year</label>
                <input type="number" value={draft.year} onChange={(e) => setDraft((d) => ({ ...d, year: Number(e.target.value) }))} className={INPUT_CLS} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Photo</label>
              <div className="flex items-center gap-3">
                {draft.photo_url && <img src={draft.photo_url} alt="" className="h-16 w-16 rounded-xl object-cover" />}
                <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                <button onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  {uploadingPhoto ? <IconSpinner className="h-3.5 w-3.5" /> : draft.photo_url ? 'Replace Photo' : 'Upload Photo'}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Message</label>
              <textarea
                value={draft.message}
                onChange={(e) => setDraft((d) => ({ ...d, message: e.target.value }))}
                rows={3}
                placeholder="e.g. Congratulations to Amit for outstanding attendance and top assessment scores this month — keep it up!"
                className={INPUT_CLS}
              />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setEditingId(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">Past Winners</p>
            <button onClick={startNew} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">+ New Winner</button>
          </div>
          <div className="space-y-2">
            {entries.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No winners yet — add one above.</p>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center gap-3">
                    {entry.photo_url ? (
                      <img src={entry.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-slate-100" />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{employeeName(entry.employee_id)}</p>
                      <p className="text-xs text-slate-400">{MONTH_NAMES[entry.month - 1]} {entry.year}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(entry)} className="text-xs font-semibold text-indigo-600 hover:underline">Edit</button>
                    <button onClick={() => handleDelete(entry.id)} className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default EmployeeOfTheMonthManagement;
