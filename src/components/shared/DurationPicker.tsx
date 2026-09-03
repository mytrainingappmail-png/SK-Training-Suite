// src/components/shared/DurationPicker.tsx
//
// "Complete within [ 48 ] [Hours ▾]" — one shared control for every admin
// assignment flow (course, learning path) that needs a duration-based
// deadline instead of picking a raw calendar date.

import type { DurationUnit } from '../../utils/deadline';
import { formatDuration } from '../../utils/deadline';

interface DurationPickerProps {
  value: number;
  unit: DurationUnit;
  onChange: (value: number, unit: DurationUnit) => void;
  disabled?: boolean;
  inputClassName?: string;
}

function DurationPicker({ value, unit, onChange, disabled, inputClassName }: DurationPickerProps) {
  const cls = inputClassName ?? 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input
          type="number"
          min={0}
          value={value || ''}
          placeholder="0 = no deadline"
          onChange={(e) => onChange(Math.max(0, parseInt(e.target.value, 10) || 0), unit)}
          disabled={disabled}
          className={`${cls} min-w-0 flex-1`}
        />
        <select
          value={unit}
          onChange={(e) => onChange(value, e.target.value as DurationUnit)}
          disabled={disabled}
          className={`${cls} w-28 flex-shrink-0`}
        >
          <option value="hours">Hours</option>
          <option value="days">Days</option>
        </select>
      </div>
      <p className="text-xs text-slate-400">{value > 0 ? `Due: ${formatDuration(value, unit)} from now` : 'No deadline set'}</p>
    </div>
  );
}

export default DurationPicker;
