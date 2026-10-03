// "Preview" of one Induction Day exactly as an employee sees it (cards, readers, locked test card),
// for the owner/admin. Nothing is saved: opening cards and "Mark Day Complete" only change what this
// preview shows, so the test card can be seen unlocked too.

import { useEffect, useState } from 'react';
import PreviewModal from '../../components/shared/PreviewModal';
import InductionDayView from '../../components/learning/InductionDayView';
import { loadSectionsForDay } from '../../services/induction/inductionService';
import type { InductionDay, InductionDaySection } from '../../types/induction';

export default function InductionDayPreview({ day, dayLabel, nextName, nextDay, onClose }: { day: InductionDay; dayLabel: string; nextName?: string; nextDay?: InductionDay; onClose: () => void }) {
  const [sections, setSections] = useState<InductionDaySection[] | null>(null);
  const [viewed, setViewed] = useState<Set<string>>(new Set());
  const [completed, setCompleted] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadSectionsForDay(day.id)
      .then((rows) => setSections([...rows].sort((a, b) => a.display_order - b.display_order)))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load this day.'));
  }, [day.id]);

  function showToast(m: string) {
    setToast(m);
    setTimeout(() => setToast(''), 3000);
  }

  return (
    <PreviewModal title={dayLabel ? `${dayLabel}: ${day.title}` : day.title} onClose={onClose}>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!sections && !error && <p className="text-sm text-slate-500">Loading…</p>}
      {sections && (
        <InductionDayView
          day={day}
          dayLabel={dayLabel}
          nextName={nextName}
          nextDay={nextDay}
          sections={sections}
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
