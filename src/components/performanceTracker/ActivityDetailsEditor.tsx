// src/components/performanceTracker/ActivityDetailsEditor.tsx
//
// The optional "details behind the numbers" of Performance Tracker: which project, what time, which client and a
// write-up for each meeting (F2F / site visit / revisit), the client behind each booking, and the data-calling
// write-up. One set of cards is used everywhere — the morning plan, the evening report, and the manager's correction
// screen — so they always look and behave the same. Nothing here is required: an empty card is simply not saved.

import { useMemo, useState } from 'react';
import type { PtActivityDetails, PtBookingRow, PtMeetingKind, PtMeetingRow } from '../../types/performanceTracker';
import { matchesProjectSearch } from '../../utils/projectSearch';
import {
  MEETING_KINDS, blankBooking, blankMeeting, describeMeeting, doneCount, formatTime, kindNoun, unansweredCount, type DetailsConfig,
} from '../../utils/ptActivityDetails';
import { Badge, ptInputCls } from './ptUi';

/** A section that opens on demand, so the plain number form stays short for anyone who does not want details. */
export function DetailsToggle({ label, openLabel = 'Hide details', open, onToggle }: { label: string; openLabel?: string; open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className="text-[11px] font-semibold text-emerald-700 hover:underline">
      {open ? `▲ ${openLabel}` : `✍ ${label}`}
    </button>
  );
}

// ── project picker: pick from the company's Projects (searchable by name / area / sector) or just type ──

export function ProjectPicker({ value, onChange, names, cfg, placeholder = 'Project' }: {
  value: string; onChange: (v: string) => void; names: string[]; cfg: DetailsConfig; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const matches = useMemo(
    () => (cfg.useProjects && open ? names.filter((n) => matchesProjectSearch(value, [n])).slice(0, 8) : []),
    [cfg.useProjects, open, names, value],
  );
  const exact = names.some((n) => n.toLowerCase() === value.trim().toLowerCase());
  return (
    <div className="relative">
      <input
        type="text" value={value} placeholder={cfg.useProjects && names.length > 0 ? `${placeholder} — pick or type` : placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={ptInputCls}
        autoComplete="off"
      />
      {matches.length > 0 && !(matches.length === 1 && exact) && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {matches.map((n) => (
            <button
              key={n} type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(n); setOpen(false); }}
              className="block w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-emerald-50"
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const labelCls = 'mb-1 block text-[11px] font-medium text-slate-600';

function Writeup({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="sm:col-span-2">
      <label className={labelCls}>Write-up</label>
      {/* a plain textarea: Enter simply starts a new line */}
      <textarea
        value={value} onChange={(e) => onChange(e.target.value)} rows={2}
        placeholder={placeholder} className={`resize-y ${ptInputCls}`}
      />
    </div>
  );
}

// ── one meeting ──

function MeetingCard({ index, singular, row, cfg, names, mode, showPlanBadge, onChange, onRemove }: {
  index: number; singular: string; row: PtMeetingRow; cfg: DetailsConfig; names: string[];
  mode: 'plan' | 'report'; showPlanBadge: boolean; onChange: (patch: Partial<PtMeetingRow>) => void; onRemove?: () => void;
}) {
  const isReport = mode === 'report';
  const missed = row.status === 'missed';
  return (
    <div className={`rounded-xl border p-3 ${missed ? 'border-rose-200 bg-rose-50/40' : row.status === 'done' ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white'}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-800">{singular} {index + 1}</span>
        {isReport && showPlanBadge && (row.planned ? <Badge tone="info">Planned</Badge> : <Badge tone="pending">Not planned</Badge>)}
        {isReport && row.planned && row.planned_as && <span className="text-[11px] text-slate-500">Planned: {row.planned_as}</span>}
        {isReport && (
          <div className="ml-auto flex gap-1.5">
            <button
              type="button" aria-pressed={row.status === 'done'} onClick={() => onChange({ status: 'done' })}
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${row.status === 'done' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-emerald-50'}`}
            >✅ Done</button>
            <button
              type="button" aria-pressed={missed} onClick={() => onChange({ status: 'missed' })}
              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${missed ? 'border-rose-600 bg-rose-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-rose-50'}`}
            >❌ Not done</button>
          </div>
        )}
        {onRemove && <button type="button" onClick={onRemove} className={`${isReport ? '' : 'ml-auto'} text-[11px] font-medium text-rose-600 hover:underline`}>Remove</button>}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Project</label>
          <ProjectPicker value={row.project} onChange={(v) => onChange({ project: v })} names={names} cfg={cfg} />
        </div>
        {cfg.askTime && (
          <div>
            <label className={labelCls}>Time</label>
            <input type="time" value={row.time} onChange={(e) => onChange({ time: e.target.value })} className={ptInputCls} />
          </div>
        )}
        {cfg.askClient && (
          <div>
            <label className={labelCls}>Client name</label>
            <input type="text" value={row.client} onChange={(e) => onChange({ client: e.target.value })} placeholder="e.g. Mr Sharma" className={ptInputCls} />
          </div>
        )}
        {cfg.askMobile && (
          <div>
            <label className={labelCls}>Client mobile (optional)</label>
            <input type="tel" inputMode="tel" value={row.mobile} onChange={(e) => onChange({ mobile: e.target.value })} className={ptInputCls} />
          </div>
        )}
        {cfg.askWriteup && (
          <Writeup
            value={row.note} onChange={(v) => onChange({ note: v })}
            placeholder={missed ? 'Why did it not happen? What is next…' : isReport ? 'How did it go, what was said, next step…' : 'Anything to note about this meeting…'}
          />
        )}
      </div>
    </div>
  );
}

// ── meetings of one kind (F2F / site visit / revisit) ──

export function MeetingRowsEditor({ kind, rows, onChange, cfg, names, mode, plannedTotal, addLabel }: {
  kind: PtMeetingKind; rows: PtMeetingRow[]; onChange: (rows: PtMeetingRow[]) => void;
  cfg: DetailsConfig; names: string[]; mode: 'plan' | 'report'; plannedTotal?: number;
  /** text of the "add" button (the manager's screen says "Add a F2F meeting", the employee's "…that was not planned") */
  addLabel?: string;
}) {
  const meta = MEETING_KINDS.find((k) => k.key === kind)!;
  const isReport = mode === 'report';
  const patchRow = (i: number, patch: Partial<PtMeetingRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const unanswered = unansweredCount(rows);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-xs font-semibold text-slate-800">{meta.label}</h4>
        {isReport && (
          <span className="text-[11px] text-slate-500">
            {doneCount(rows)} done{plannedTotal ? ` of ${plannedTotal} planned` : ''}
          </span>
        )}
        {isReport && rows.some((r) => r.planned) && unanswered > 0 && (
          <button
            type="button"
            onClick={() => onChange(rows.map((r) => (r.planned && !r.status ? { ...r, status: 'done' } : r)))}
            className="ml-auto text-[11px] font-medium text-emerald-700 hover:underline"
          >Mark all planned as done</button>
        )}
      </div>
      {rows.map((r, i) => (
        <MeetingCard
          key={r.id} index={i} singular={meta.singular} row={r} cfg={cfg} names={names} mode={mode}
          showPlanBadge={(plannedTotal ?? 0) > 0 || rows.some((x) => x.planned)}
          onChange={(p) => patchRow(i, p)}
          onRemove={isReport && !r.planned ? () => onChange(rows.filter((_, j) => j !== i)) : undefined}
        />
      ))}
      {isReport && unanswered > 0 && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          {unanswered} planned {kindNoun(kind, unanswered)} {unanswered === 1 ? 'is' : 'are'} not marked yet — tap ✅ Done or ❌ Not done. Unmarked ones count as not done.
        </p>
      )}
      {isReport && (
        <button
          type="button"
          onClick={() => onChange([...rows, blankMeeting({ planned: false, status: 'done' })])}
          className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:border-emerald-400 hover:text-emerald-700"
        >{addLabel ?? `+ Add a ${kindNoun(kind, 1)} that was not planned`}</button>
      )}
    </div>
  );
}

// ── bookings ──

export function BookingRowsEditor({ rows, onChange, cfg, names }: {
  rows: PtBookingRow[]; onChange: (rows: PtBookingRow[]) => void; cfg: DetailsConfig; names: string[];
}) {
  const patch = (i: number, p: Partial<PtBookingRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-slate-800">Bookings</h4>
      {rows.map((r, i) => (
        <div key={r.id} className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-800">Booking {i + 1}</span>
            <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="ml-auto text-[11px] font-medium text-rose-600 hover:underline">Remove</button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Client name</label>
              <input type="text" value={r.client} onChange={(e) => patch(i, { client: e.target.value })} className={ptInputCls} />
            </div>
            {cfg.askMobile && (
              <div>
                <label className={labelCls}>Client mobile (optional)</label>
                <input type="tel" inputMode="tel" value={r.mobile} onChange={(e) => patch(i, { mobile: e.target.value })} className={ptInputCls} />
              </div>
            )}
            <div>
              <label className={labelCls}>Project</label>
              <ProjectPicker value={r.project} onChange={(v) => patch(i, { project: v })} names={names} cfg={cfg} />
            </div>
            <div>
              <label className={labelCls}>Unit / size / tower</label>
              <input type="text" value={r.unit} onChange={(e) => patch(i, { unit: e.target.value })} placeholder="e.g. 3 BHK, T2-1204" className={ptInputCls} />
            </div>
            <div>
              <label className={labelCls}>Booking amount (optional)</label>
              <input type="text" value={r.amount} onChange={(e) => patch(i, { amount: e.target.value })} placeholder="e.g. 5 lakh token" className={ptInputCls} />
            </div>
            {cfg.askWriteup && <Writeup value={r.note} onChange={(v) => patch(i, { note: v })} placeholder="How it closed, payment plan, anything the manager should know…" />}
          </div>
        </div>
      ))}
      <button
        type="button" onClick={() => onChange([...rows, blankBooking()])}
        className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:border-emerald-400 hover:text-emerald-700"
      >+ Add booking details</button>
    </div>
  );
}

// ── read-only view (employee's own submitted report, the manager's screen, the team board) ──

function MeetingLine({ r }: { r: PtMeetingRow }) {
  const tone = r.status === 'missed' ? 'rejected' : r.status === 'done' ? 'active' : 'gray';
  return (
    <li className="rounded-lg border border-slate-100 bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge tone={tone}>{r.status === 'missed' ? 'Not done' : r.status === 'done' ? 'Done' : r.status === undefined && r.planned === undefined ? 'Planned' : 'Not marked'}</Badge>
        {r.planned === false && <Badge tone="pending">Not planned</Badge>}
        <span className="font-semibold text-slate-800">{r.project || '—'}</span>
        {r.time && <span className="text-slate-500">{formatTime(r.time)}</span>}
        {r.client && <span className="text-slate-700">· {r.client}</span>}
        {r.mobile && <span className="text-slate-500">· {r.mobile}</span>}
      </div>
      {r.planned && r.planned_as && describeMeeting(r) !== r.planned_as && <p className="mt-1 text-[11px] text-slate-500">Planned: {r.planned_as}</p>}
      {r.note && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{r.note}</p>}
    </li>
  );
}

export function ActivityDetailsView({ details, plan }: { details?: PtActivityDetails | null; plan?: PtActivityDetails | null }) {
  const d = details ?? {};
  const sections: React.ReactNode[] = [];
  for (const k of MEETING_KINDS) {
    const rows = d[k.key] ?? plan?.[k.key] ?? [];
    if (rows.length === 0) continue;
    sections.push(
      <div key={k.key}>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{k.label}{!d[k.key] ? ' (planned)' : ''}</p>
        <ul className="space-y-1.5">{rows.map((r) => <MeetingLine key={r.id} r={r} />)}</ul>
      </div>,
    );
  }
  if ((d.bookings?.length ?? 0) > 0) {
    sections.push(
      <div key="bookings">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Bookings</p>
        <ul className="space-y-1.5">
          {d.bookings!.map((b) => (
            <li key={b.id} className="rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge tone="active">Booked</Badge>
                <span className="font-semibold text-slate-800">{b.client || '—'}</span>
                {b.mobile && <span className="text-slate-500">{b.mobile}</span>}
                {b.project && <span className="text-slate-700">· {b.project}</span>}
                {b.unit && <span className="text-slate-700">· {b.unit}</span>}
                {b.amount && <span className="text-slate-700">· {b.amount}</span>}
              </div>
              {b.note && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{b.note}</p>}
            </li>
          ))}
        </ul>
      </div>,
    );
  }
  if (d.calling && ((d.calling.prospects ?? 0) > 0 || d.calling.note?.trim())) {
    sections.push(
      <div key="calling">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Data calling</p>
        <div className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs">
          <span className="font-semibold text-slate-800">{d.calling.prospects} prospect{d.calling.prospects === 1 ? '' : 's'} created</span>
          {d.calling.note && <p className="mt-1 whitespace-pre-wrap text-slate-600">{d.calling.note}</p>}
        </div>
      </div>,
    );
  }
  if (sections.length === 0) return <p className="text-xs text-slate-500">No details were written.</p>;
  return <div className="space-y-3">{sections}</div>;
}
