// "I have read and agree" card: the admin's text, a tick box and a button. Remembers who agreed and when.

import { useState } from 'react';
import { sanitizeHtml } from '../../../utils/sanitizeHtml';
import type { InductionCardResponse, InductionDaySection } from '../../../types/induction';

export interface CardProps {
  section: InductionDaySection;
  response?: InductionCardResponse;
  /** Saves the employee's answer. Throws with a readable message when it fails. */
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  showToast: (message: string) => void;
}

export default function AcknowledgeCard({ section, response, onSubmit, showToast }: CardProps) {
  const cfg = section.config ?? {};
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);

  async function agree() {
    setBusy(true);
    try { await onSubmit({ agreed: true }); }
    catch (e) { showToast(e instanceof Error ? e.message : 'Could not save. Please try again.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      {section.page_content && (
        <div className="prose prose-sm max-w-none rounded-xl bg-slate-50 p-5 text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(section.page_content) }} />
      )}

      {response ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          ✓ You agreed on {new Date(response.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50 p-4">
          <label className="flex cursor-pointer items-start gap-3 text-sm font-medium text-indigo-900">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5 h-5 w-5 flex-shrink-0" />
            {cfg.checkbox_label?.trim() || 'I have read and understood this, and I agree.'}
          </label>
          <button
            type="button" onClick={agree} disabled={!checked || busy}
            className="mt-4 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Saving…' : cfg.button_label?.trim() || 'I agree'}
          </button>
        </div>
      )}
    </div>
  );
}
