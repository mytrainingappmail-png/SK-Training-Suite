// src/modules/permissions/RoleManagement.tsx
//
// Authorization Foundation — Phase 1. Role CRUD (Super Admin, Admin,
// Trainer, Employee + any custom roles). Not yet wired into
// sidebar/routes — standalone module per Phase 1 scope.

import { useEffect, useState } from 'react';
import {
  loadRoles,
  createNewRole,
  saveRole,
  removeRole,
  seedDefaultRoles,
} from '../../services/permission/permissionService';
import type { Role } from '../../types/permission';

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
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100" />)}
    </div>
  );
}
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load roles</p>
      <p className="mt-1">{message}</p>
      <SecondaryButton onClick={onRetry} className="mt-4">Try Again</SecondaryButton>
    </div>
  );
}
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
      <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
      <p className="font-medium">{message}</p>
    </div>
  );
}

function RoleManagement() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [creatingOpen, setCreatingOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleCode, setNewRoleCode] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    setError('');
    loadRoles()
      .then(setRoles)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load roles.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  async function handleSeedDefaults() {
    setSeeding(true);
    try {
      const created = await seedDefaultRoles(roles);
      fetchAll();
      showToast(created.length > 0 ? `Created ${created.length} default role(s)` : 'Default roles already exist');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to seed default roles.');
    } finally {
      setSeeding(false);
    }
  }

  async function handleCreate() {
    if (!newRoleName.trim() || !newRoleCode.trim()) return;
    setCreating(true);
    try {
      await createNewRole({
        role_name: newRoleName.trim(),
        role_code: newRoleCode.trim().toLowerCase().replace(/\s+/g, '_'),
        description: newRoleDescription.trim(),
        is_system: false,
        active: true,
      });
      setCreatingOpen(false);
      setNewRoleName('');
      setNewRoleCode('');
      setNewRoleDescription('');
      fetchAll();
      showToast('Role created');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create role.');
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(role: Role) {
    try {
      await saveRole(role.id, { active: !role.active });
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update role.');
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await removeRole(deleteTarget.id, roles);
      setDeleteTarget(null);
      fetchAll();
      showToast('Role deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete role.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Roles</h2>
          <p className="text-sm text-slate-500">Manage the roles available for permission assignment.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton onClick={handleSeedDefaults} disabled={seeding}>
            {seeding ? <IconSpinner className="h-3.5 w-3.5" /> : null} Seed Default Roles
          </SecondaryButton>
          <PrimaryButton onClick={() => setCreatingOpen(true)}><IconPlus className="h-3.5 w-3.5" /> Create Role</PrimaryButton>
        </div>
      </div>

      {roles.length === 0 ? (
        <EmptyState message="No roles yet — seed the defaults or create one." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {roles.map((role) => (
            <div key={role.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-semibold text-slate-800">{role.role_name}</p>
                <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${role.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {role.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="mb-1 font-mono text-xs text-indigo-500">{role.role_code}</p>
              <p className="mb-3 text-xs text-slate-400">{role.description || 'No description.'}</p>
              <div className="flex flex-wrap items-center gap-2">
                <SecondaryButton onClick={() => handleToggleActive(role)}>{role.active ? 'Deactivate' : 'Activate'}</SecondaryButton>
                {!role.is_system && (
                  <DangerButton onClick={() => setDeleteTarget(role)}><IconTrash /> Delete</DangerButton>
                )}
                {role.is_system && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">System Role</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {creatingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setCreatingOpen(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-lg font-bold text-slate-900">Create Role</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Role Name</label>
                <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} className={INPUT_CLS} placeholder="e.g. Regional Manager" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Role Code</label>
                <input value={newRoleCode} onChange={(e) => setNewRoleCode(e.target.value)} className={INPUT_CLS} placeholder="e.g. regional_manager" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Description</label>
                <textarea value={newRoleDescription} onChange={(e) => setNewRoleDescription(e.target.value)} rows={3} className={`${INPUT_CLS} resize-none`} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <SecondaryButton onClick={() => setCreatingOpen(false)} disabled={creating}>Cancel</SecondaryButton>
              <PrimaryButton onClick={handleCreate} disabled={creating || !newRoleName.trim() || !newRoleCode.trim()}>
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
            <h3 className="mb-1 text-lg font-bold text-slate-900">Delete Role</h3>
            <p className="mb-5 text-sm text-slate-500">Delete "{deleteTarget.role_name}"? This cannot be undone.</p>
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

export default RoleManagement;
