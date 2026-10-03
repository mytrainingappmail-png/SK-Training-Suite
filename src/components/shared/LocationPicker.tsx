// "Who should see this?" — all locations, or only the ticked ones. Used on Induction days and sections
// (owner's master account only; companies just receive the result).

import { LOCATIONS } from '../../constants/locations';

export default function LocationPicker({ value, onChange, subject }: { value: string[] | null; onChange: (next: string[] | null) => void; subject: string }) {
  const specific = !!value && value.length > 0;
  // "Only these" with nothing ticked yet is kept as an empty list in the screen's state until a city is picked.
  const mode: 'all' | 'only' = value === null ? 'all' : 'only';

  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-500">Who should see this {subject}?</label>
      <div className="flex flex-wrap gap-2">
        <label className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${mode === 'all' ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
          <input type="radio" checked={mode === 'all'} onChange={() => onChange(null)} /> All locations
        </label>
        <label className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm ${mode === 'only' ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
          <input type="radio" checked={mode === 'only'} onChange={() => onChange(value ?? [])} /> Only specific locations
        </label>
      </div>
      {mode === 'only' && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {LOCATIONS.map((l) => {
            const on = (value ?? []).includes(l.key);
            return (
              <button
                key={l.key} type="button"
                onClick={() => onChange(on ? (value ?? []).filter((k) => k !== l.key) : [...(value ?? []), l.key])}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${on ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {on ? '✓ ' : ''}{l.label}
              </button>
            );
          })}
        </div>
      )}
      {mode === 'only' && !specific && <p className="mt-1 text-xs text-amber-600">Nothing ticked yet — until you tick a location this is shown to everyone.</p>}
      <p className="mt-1 text-xs text-slate-400">An employee's location is the city of their branch. Employees whose branch has no known city only see content for "All locations".</p>
    </div>
  );
}
