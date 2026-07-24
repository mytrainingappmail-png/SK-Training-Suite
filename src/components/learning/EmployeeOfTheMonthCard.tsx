// Shows the most recently set Employee of the Month, if any. Renders
// nothing when none has been set yet, so it never disrupts the page for
// companies that haven't used this feature.

import { useEffect, useState } from 'react';
import { loadCurrent } from '../../services/employeeOfTheMonth/employeeOfTheMonthService';
import { employeeService } from '../../services/employee/employeeService';
import { MONTH_NAMES } from '../../types/employeeOfTheMonth';
import type { EmployeeOfTheMonth } from '../../types/employeeOfTheMonth';

function EmployeeOfTheMonthCard() {
  const [entry, setEntry] = useState<EmployeeOfTheMonth | null>(null);
  const [employeeName, setEmployeeName] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadCurrent()
      .then(async (e) => {
        setEntry(e);
        if (e) {
          const employees = await employeeService.getAll();
          const emp = employees.find((x) => x.id === e.employee_id);
          setEmployeeName(emp ? `${emp.first_name} ${emp.last_name}` : '');
        }
      })
      .catch(() => setEntry(null))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || !entry) return null;

  return (
    <div
      className="overflow-hidden rounded-2xl p-6 text-white shadow-md"
      style={{ background: 'linear-gradient(135deg, #78350F 0%, #B45309 50%, #F59E0B 100%)' }}
    >
      <div className="flex flex-wrap items-center gap-5">
        {entry.photo_url ? (
          <img src={entry.photo_url} alt={employeeName} className="h-20 w-20 flex-shrink-0 rounded-2xl object-cover ring-4 ring-white/30" />
        ) : (
          <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-2xl bg-white/20 text-3xl">🏆</div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-100">
            🏆 Employee of the Month — {MONTH_NAMES[entry.month - 1]} {entry.year}
          </p>
          <h3 className="mt-0.5 text-xl font-bold">{employeeName}</h3>
          {entry.message && <p className="mt-1.5 text-sm leading-relaxed text-amber-50/90">{entry.message}</p>}
        </div>
      </div>
    </div>
  );
}

export default EmployeeOfTheMonthCard;
