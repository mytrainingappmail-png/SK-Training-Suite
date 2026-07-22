// src/modules/permissions/PermissionManagement.tsx
//
// Authorization Foundation. Master permission list CRUD
// (permission_code / permission_name / module_name). Not yet wired into
// sidebar/routes — standalone module.

import { useEffect, useState } from 'react';
import {
  loadPermissions,
  createPermission,
  savePermission,
  removePermission,
  seedDefaultPermissions,
} from '../../services/permission/permissionService';
import { defaultPermissionForm, MODULE_NAMES } from '../../types/permission';
import type { Permission, PermissionForm } from '../../types/permission';

function IconPlus({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>);
}
function IconTrash({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166M4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>);
}
function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}

function PrimaryButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]">
      {children}
    </button>
  );
}
function SecondaryButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/70 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}
function DangerButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]">
      {children}
    </button>
  );
}
const INPUT_CLS = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';

function Skeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}
    </div>
  );
}
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load permissions</p>
      <p className="mt-1">{message}</p>
      <SecondaryButton onClick={onRetry} className="mt-4">Try Again</SecondaryButton>
    </div>
  );
}
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
      <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
      <p className="font-medium">{message}</p>
    </div>
  );
}

function PermissionManagement() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');

  const [creatingOpen, setCreatingOpen] = useState(false);
  const [newPermission, setNewPermission] = useState<PermissionForm>(defaultPermissionForm);
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Permission | null>(null);
  const [deleting, setDeleting] = useState(false);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    setError('');
    loadPermissions()
      .then(setPermissions)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load permissions.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  async function handleSeedDefaults() {
    setSeeding(true);
    try {
      const created = await seedDefaultPermissions(permissions);
      fetchAll();
      showToast(created.length > 0 ? `Created ${created.length} default permission(s)` : 'Default permissions already exist');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to seed default permissions.');
    } finally {
      setSeeding(false);
    }
  }

  async function handleCreate() {
    if (!newPermission.permission_code.trim() || !newPermission.permission_name.trim() || !newPermission.module_name.trim()) return;
    setCreating(true);
    try {
      await createPermission(newPermission);
      setCreatingOpen(false);
      setNewPermission(defaultPermissionForm);
      fetchAll();
      showToast('Permission created');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create permission.');
    } finally {
      setCreating(false);
    }
  }

  async function handleFieldBlur(permission: Permission, patch: Partial<PermissionForm>) {
    const changed = Object.entries(patch).some(([key, value]) => (permission as unknown as Record<string, unknown>)[key] !== value);
    if (!changed) return;
    try {
      await savePermission(permission.id, patch);
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update permission.');
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await removePermission(deleteTarget.id);
      setDeleteTarget(null);
      fetchAll();
      showToast('Permission deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete permission.');
    } finally {
      setDeleting(false);
    }
  }

  const searchTerm = search.trim().toLowerCase();
  const filteredPermissions = permissions.filter((p) => {
    if (moduleFilter !== 'all' && p.module_name !== moduleFilter) return false;
    if (!searchTerm) return true;
    return p.permission_code.toLowerCase().includes(searchTerm) || p.permission_name.toLowerCase().includes(searchTerm) || p.module_name.toLowerCase().includes(searchTerm);
  });

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Permissions</h2>
          <p className="text-sm text-slate-500">The master list of permissions used across the app.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton onClick={handleSeedDefaults} disabled={seeding}>
            {seeding ? <IconSpinner className="h-3.5 w-3.5" /> : null} Seed Default Permissions
          </SecondaryButton>
          <PrimaryButton onClick={() => { setNewPermission(defaultPermissionForm); setCreatingOpen(true); }}><IconPlus className="h-3.5 w-3.5" /> Create Permission</PrimaryButton>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl bg-white p-4 shadow-sm">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by code, name or module…" className={`${INPUT_CLS} flex-1`} />
        <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className={INPUT_CLS + ' max-w-[200px]'}>
          <option value="all">All Modules</option>
          {MODULE_NAMES.map((m) => (<option key={m} value={m}>{m}</option>))}
        </select>
      </div>

      {filteredPermissions.length === 0 ? (
        <EmptyState message="No permissions match — seed the defaults or create one." />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPermissions.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-indigo-600">{p.permission_code}</td>
                  <td className="px-4 py-2.5">
                    <input
                      key={`${p.id}-name`}
                      defaultValue={p.permission_name}
                      onBlur={(e) => handleFieldBlur(p, { permission_name: e.target.value })}
                      className="w-full rounded-lg bg-slate-50 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">{p.module_name}</td>
                  <td className="px-4 py-2.5">
                    <input
                      key={`${p.id}-desc`}
                      defaultValue={p.description}
                      onBlur={(e) => handleFieldBlur(p, { description: e.target.value })}
                      placeholder="Add a description…"
                      className="w-full rounded-lg bg-slate-50 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => setDeleteTarget(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><IconTrash /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creatingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setCreatingOpen(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-bold text-slate-900">Create Permission</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Permission Code</label>
                <input
                  value={newPermission.permission_code}
                  onChange={(e) => setNewPermission((p) => ({ ...p, permission_code: e.target.value }))}
                  className={`${INPUT_CLS} font-mono`}
                  placeholder="e.g. course.publish"
                />
                <p className="mt-1 text-[11px] text-slate-400">Format: module.action</p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Permission Name</label>
                <input
                  value={newPermission.permission_name}
                  onChange={(e) => setNewPermission((p) => ({ ...p, permission_name: e.target.value }))}
                  className={INPUT_CLS}
                  placeholder="e.g. Publish Course"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Module</label>
                <select
                  value={newPermission.module_name}
                  onChange={(e) => setNewPermission((p) => ({ ...p, module_name: e.target.value }))}
                  className={INPUT_CLS}
                >
                  <option value="">Select a module…</option>
                  {MODULE_NAMES.map((m) => (<option key={m} value={m}>{m}</option>))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Description</label>
                <textarea
                  value={newPermission.description}
                  onChange={(e) => setNewPermission((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                  className={`${INPUT_CLS} resize-none`}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <SecondaryButton onClick={() => setCreatingOpen(false)} disabled={creating}>Cancel</SecondaryButton>
              <PrimaryButton
                onClick={handleCreate}
                disabled={creating || !newPermission.permission_code.trim() || !newPermission.permission_name.trim() || !newPermission.module_name.trim()}
              >
                {creating ? <IconSpinner className="h-3.5 w-3.5" /> : null} Create
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDeleteTarget(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold text-slate-900">Delete Permission</h3>
            <p className="mb-5 text-sm text-slate-500">Delete "{deleteTarget.permission_name}"? Any role grants for it will no longer apply.</p>
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</SecondaryButton>
              <DangerButton onClick={handleDeleteConfirm} disabled={deleting}>
                {deleting ? <IconSpinner className="h-3.5 w-3.5" /> : <IconTrash />} Delete
              </DangerButton>
            </div>
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

export default PermissionManagement;
