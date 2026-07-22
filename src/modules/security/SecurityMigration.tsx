// src/modules/security/SecurityMigration.tsx
//
// Final phase of the login security migration — a real, safe Admin
// tool. Lists every real employee not yet migrated to secure login,
// and migrates them one at a time with live progress. Each
// employee's existing password is reused — nothing changes for them.
// Not yet wired into sidebar/routes beyond the Admin tab this is
// added to.

import { useEffect, useState } from 'react';
import {
  loadUnmigratedEmployees,
  migrateAllEmployees,
} from '../../services/security/migrationService';
import type { UnmigratedEmployee, MigrationOutcome } from '../../services/security/migrationService';

function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}
function IconShield({ className = 'h-5 w-5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>);
}

function PrimaryButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (<button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]">{children}</button>);
}
function SecondaryButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (<button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/70 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]">{children}</button>);
}

function SecurityMigration() {
  const [employees, setEmployees] = useState<UnmigratedEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [outcomes, setOutcomes] = useState<MigrationOutcome[]>([]);

  function fetchAll() {
    setLoading(true);
    setError('');
    loadUnmigratedEmployees()
      .then(setEmployees)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load employees.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  async function handleMigrateAll() {
    setMigrating(true);
    setOutcomes([]);
    setProgress({ completed: 0, total: employees.length });

    const results = await migrateAllEmployees(employees, (completed, total) => {
      setProgress({ completed, total });
    });

    setOutcomes(results);
    setMigrating(false);
    fetchAll();
  }

  const succeeded = outcomes.filter((o) => o.success).length;
  const failed = outcomes.filter((o) => !o.success).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          <IconShield />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Secure Login Migration</h2>
          <p className="mt-1 text-sm text-slate-500">
            Moves employees to real, secure login accounts — their company code, employee ID, and password all stay exactly the same.
            This only changes what happens behind the scenes so each employee's data stays correctly restricted to their own company.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
          <div className="mt-3"><SecondaryButton onClick={fetchAll}>Try Again</SecondaryButton></div>
        </div>
      ) : employees.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 py-16 text-center text-emerald-700">
          <p className="font-semibold">All employees are already on secure login.</p>
          <p className="mt-1 text-sm">Nothing left to migrate.</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">{employees.length} employee(s) not yet migrated</p>
              <PrimaryButton onClick={handleMigrateAll} disabled={migrating}>
                {migrating ? <IconSpinner className="h-3.5 w-3.5" /> : null}
                {migrating ? `Migrating ${progress.completed}/${progress.total}…` : 'Migrate All Now'}
              </PrimaryButton>
            </div>

            {migrating && (
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }}
                />
              </div>
            )}

            <div className="mt-4 max-h-64 divide-y divide-slate-100 overflow-y-auto">
              {employees.map((emp) => (
                <div key={emp.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-700">{emp.first_name} {emp.last_name}</span>
                  <span className="font-mono text-xs text-slate-400">{emp.employee_code}</span>
                </div>
              ))}
            </div>
          </div>

          {outcomes.length > 0 && (
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <p className="mb-3 text-sm font-semibold text-slate-700">
                Migration Result: <span className="text-emerald-600">{succeeded} succeeded</span>
                {failed > 0 && <span className="text-red-600"> · {failed} failed</span>}
              </p>
              {failed > 0 && (
                <div className="space-y-1.5">
                  {outcomes.filter((o) => !o.success).map((o) => (
                    <div key={o.employeeId} className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                      <span className="font-mono font-semibold">{o.employeeCode}</span>: {o.error}
                    </div>
                  ))}
                  <p className="mt-2 text-xs text-slate-400">Click "Migrate All Now" again to retry only the employees still remaining.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SecurityMigration;
