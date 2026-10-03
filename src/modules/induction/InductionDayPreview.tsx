// "Preview" of one Induction Day exactly as an employee sees it (cards, readers, locked test card),
// for the owner/admin. Nothing is saved: opening cards and "Mark Day Complete" only change what this
// preview shows, so the test card can be seen unlocked too.

import { useEffect, useState } from 'react';
import PreviewModal from '../../components/shared/PreviewModal';
import InductionDayView from '../../components/learning/InductionDayView';
import { loadSectionsForDay } from '../../services/induction/inductionService';
import { LOCATIONS, visibleInLocation } from '../../constants/locations';
import type { InductionDay, InductionDaySection } from '../../types/induction';

export default function InductionDayPreview({ day, dayLabel, nextName, nextDay, onClose }: { day: InductionDay; dayLabel: string; nextName?: string; nextDay?: InductionDay; onClose: () => void }) {
  const [sections, setSections] = useState<InductionDaySection[] | null>(null);
  const [viewed, setViewed] = useState<Set<string>>(new Set());
  const [completed, setCompleted] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  // '' = everything (as the owner sees it); a city key = only what an employee in that location would see.
  const [asLocation, setAsLocation] = useState('');

  useEffect(() => {
    loadSectionsForDay(day.id)
      .then((rows) => setSections([...rows].sort((a, b) => a.display_order - b.display_order)))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load this day.'));
  }, [day.id]);

  function showToast(m: string) {
    setToast(m);
    setTimeout(() => setToast(''), 3000);
  }

  // Only worth showing when something about this day depends on the location.
  const hasLocationRules = (day.locations ?? []).length > 0 || (sections ?? []).some((s) => (s.locations ?? []).length > 0);
  const shownSections = sections && asLocation ? sections.filter((s) => visibleInLocation(s.locations, asLocation)) : sections;

  return (
    <PreviewModal title={dayLabel ? `${dayLabel}: ${day.title}` : day.title} onClose={onClose}>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!sections && !error && <p className="text-sm text-slate-500">Loading…</p>}
      {hasLocationRules && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-800">
          <span className="font-semibold">📍 Preview as an employee in:</span>
          <select value={asLocation} onChange={(e) => setAsLocation(e.target.value)} className="rounded-lg border border-rose-200 bg-white px-2 py-1 text-sm">
            <option value="">Everything (all locations)</option>
            {LOCATIONS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
        </div>
      )}
      {shownSections && (
        <InductionDayView
          day={day}
          dayLabel={dayLabel}
          nextName={nextName}
          nextDay={nextDay}
          sections={shownSections ?? []}
          viewedIds={viewed}
          completed={completed}
          passedTestIds={new Set()}
          preview
          onBack={onClose}
          onOpenSection={(s) => setViewed((prev) => new Set(prev).add(s.id))}
          onMarkComplete={() => { setCompleted(true); showToast('Preview: day marked complete — the test card is now unlocked. Nothing was saved.'); }}
          onStartTest={() => showToast('Preview: the employee takes the test here.')}
          showToast={showToast}
        />
      )}
      {toast && <div className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div>}
    </PreviewModal>
  );
}
