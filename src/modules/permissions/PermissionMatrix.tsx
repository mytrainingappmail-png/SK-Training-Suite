// src/modules/permissions/PermissionMatrix.tsx
//
// Authorization Foundation. Permission Matrix: rows = permissions,
// columns = Super Admin / Admin / Trainer / Employee, checkbox grid,
// Save button. Loads existing role_permissions and persists only the
// changed cells. Uses the single canonical shapes from
// types/permission.ts exclusively. Not yet wired into sidebar/routes —
// standalone module.

import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  loadRoles,
  loadPermissions,
  loadRolePermissions,
  saveMatrixChanges,
  seedDefaultRoles,
  seedDefaultPermissions,
} from '../../services/permission/permissionService';
import { DEFAULT_ROLES } from '../../types/permission';
import type { Role, Permission, RolePermission } from '../../types/permission';

function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}
function IconSave({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>);
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

function Skeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-slate-100" />)}
    </div>
  );
}
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load the permission matrix</p>
      <p className="mt-1">{message}</p>
      <SecondaryButton onClick={onRetry} className="mt-4">Try Again</SecondaryButton>
    </div>
  );
}
function EmptyState({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
      <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" /></svg>
      <p className="font-medium">{message}</p>
      {action}
    </div>
  );
}

function PermissionMatrix() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [saving, setSaving] = useState(false);

  // grid[roleId][permissionId] = granted (current, editable state)
  const [grid, setGrid] = useState<Record<string, Record<string, boolean>>>({});

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    setError('');
    Promise.all([loadRoles(), loadPermissions(), loadRolePermissions()])
      .then(([roleRows, permissionRows, rolePermissionRows]) => {
        setRoles(roleRows);
        setPermissions(permissionRows);
        setRolePermissions(rolePermissionRows);

        const nextGrid: Record<string, Record<string, boolean>> = {};
        roleRows.forEach((role) => {
          nextGrid[role.id] = {};
          permissionRows.forEach((permission) => {
            nextGrid[role.id][permission.id] = rolePermissionRows.some(
              (rp) => rp.role_id === role.id && rp.permission_id === permission.id
            );
          });
        });
        setGrid(nextGrid);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load the permission matrix.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  const columnRoles = useMemo(() => {
    const order = DEFAULT_ROLES.map((r) => r.role_code);
    return order
      .map((code) => roles.find((r) => r.role_code === code))
      .filter((r): r is Role => !!r);
  }, [roles]);

  const searchTerm = search.trim().toLowerCase();

  const permissionsByModule = useMemo(() => {
    const filtered = !searchTerm
      ? permissions
      : permissions.filter(
          (p) =>
            p.permission_code.toLowerCase().includes(searchTerm) ||
            p.permission_name.toLowerCase().includes(searchTerm) ||
            p.module_name.toLowerCase().includes(searchTerm)
        );
    const groups = new Map<string, Permission[]>();
    filtered.forEach((p) => {
      const list = groups.get(p.module_name) ?? [];
      list.push(p);
      groups.set(p.module_name, list);
    });
    return Array.from(groups.entries());
  }, [permissions, searchTerm]);

  const missingDefaults = columnRoles.length < DEFAULT_ROLES.length || permissions.length === 0;

  async function handleSeedMissing() {
    setSeeding(true);
    try {
      await seedDefaultRoles(roles);
      await seedDefaultPermissions(permissions);
      fetchAll();
      showToast('Defaults seeded');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to seed defaults.');
    } finally {
      setSeeding(false);
    }
  }

  function toggleCell(roleId: string, permissionId: string) {
    setGrid((prev) => ({
      ...prev,
      [roleId]: { ...prev[roleId], [permissionId]: !prev[roleId]?.[permissionId] },
    }));
  }

  function toggleColumn(roleId: string) {
    const allGranted = permissions.every((p) => grid[roleId]?.[p.id]);
    setGrid((prev) => {
      const nextColumn: Record<string, boolean> = {};
      permissions.forEach((p) => { nextColumn[p.id] = !allGranted; });
      return { ...prev, [roleId]: nextColumn };
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const changes: { roleId: string; permissionId: string; granted: boolean }[] = [];
      columnRoles.forEach((role) => {
        permissions.forEach((permission) => {
          const current = grid[role.id]?.[permission.id] ?? false;
          const original = rolePermissions.some(
            (rp) => rp.role_id === role.id && rp.permission_id === permission.id
          );
          if (current !== original) {
            changes.push({ roleId: role.id, permissionId: permission.id, granted: current });
          }
        });
      });

      if (changes.length === 0) {
        showToast('No changes to save');
        return;
      }

      await saveMatrixChanges(changes);
      fetchAll();
      showToast(`Saved ${changes.length} change(s)`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save the permission matrix.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Permission Matrix</h2>
          <p className="text-sm text-slate-500">Grant or revoke permissions per role, then Save.</p>
        </div>
        <PrimaryButton onClick={handleSave} disabled={saving || missingDefaults}>
          {saving ? <IconSpinner className="h-3.5 w-3.5" /> : <IconSave className="h-4 w-4" />} Save
        </PrimaryButton>
      </div>

      {!missingDefaults && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by permission code, name or module…"
            className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
          />
        </div>
      )}

      {missingDefaults ? (
        <EmptyState
          message="Default roles and/or permissions haven't been seeded yet."
          action={
            <SecondaryButton onClick={handleSeedMissing} disabled={seeding}>
              {seeding ? <IconSpinner className="h-3.5 w-3.5" /> : null} Seed Defaults
            </SecondaryButton>
          }
        />
      ) : permissionsByModule.length === 0 ? (
        <EmptyState message="No permissions match your search." />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="sticky left-0 bg-slate-50 px-4 py-3">Permission</th>
                {columnRoles.map((role) => (
                  <th key={role.id} className="px-4 py-3 text-center">
                    <button onClick={() => toggleColumn(role.id)} className="font-semibold text-slate-500 hover:text-indigo-600" title="Toggle entire column">
                      {role.role_name}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {permissionsByModule.map(([moduleName, modulePermissions]) => (
                <Fragment key={moduleName}>
                  <tr className="bg-slate-50/70">
                    <td colSpan={1 + columnRoles.length} className="px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                      {moduleName}
                    </td>
                  </tr>
                  {modulePermissions.map((permission) => (
                    <tr key={permission.id}>
                      <td className="sticky left-0 bg-white px-4 py-2.5">
                        <p className="text-sm font-semibold text-slate-700">{permission.permission_name}</p>
                        <p className="font-mono text-[11px] text-slate-400">{permission.permission_code}</p>
                      </td>
                      {columnRoles.map((role) => (
                        <td key={role.id} className="px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={!!grid[role.id]?.[permission.id]}
                            onChange={() => toggleCell(role.id, permission.id)}
                            className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-400"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
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

export default PermissionMatrix;
