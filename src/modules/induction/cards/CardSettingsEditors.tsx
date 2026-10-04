// Admin editors for the optional card kinds. Every wording, question and rule is the admin's own — the only
// ready-made thing is the "standard feedback questions" button, which just fills in a starting list to edit.

import { COMPLETABLE_TYPES, newQuestionId, standardFeedbackQuestions, REQUIREMENT_LABEL } from '../../../utils/inductionCards';
import type { FeedbackQuestion, FeedbackQuestionType, InductionCardConfig, InductionRequirement, InductionSectionType } from '../../../types/induction';

const INPUT = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';
const LABEL = 'mb-1 block text-xs font-semibold text-slate-500';

type ConfigProps = { config: InductionCardConfig; onChange: (next: InductionCardConfig) => void };

/** "Is this card needed to finish the day?" — for every kind of card except a test. */
export function RequirementSelect({ type, value, onChange }: { type: InductionSectionType; value: InductionRequirement; onChange: (v: InductionRequirement) => void }) {
  const options: InductionRequirement[] = COMPLETABLE_TYPES.has(type) ? ['none', 'open', 'complete'] : ['none', 'open'];
  const shown = options.includes(value) ? value : 'open';
  return (
    <div>
      <label className={LABEL}>Needed to finish the day?</label>
      <select value={shown} onChange={(e) => onChange(e.target.value as InductionRequirement)} className={INPUT}>
        {options.map((o) => <option key={o} value={o}>{REQUIREMENT_LABEL[o]}</option>)}
      </select>
    </div>
  );
}

export function AcknowledgeSettings({ config, onChange }: ConfigProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <label className={LABEL}>Tick-box wording</label>
        <input value={config.checkbox_label ?? ''} onChange={(e) => onChange({ ...config, checkbox_label: e.target.value })} placeholder="I have read and understood this, and I agree." className={INPUT} />
      </div>
      <div>
        <label className={LABEL}>Button wording</label>
        <input value={config.button_label ?? ''} onChange={(e) => onChange({ ...config, button_label: e.target.value })} placeholder="I agree" className={INPUT} />
      </div>
      <p className="text-xs text-slate-400 sm:col-span-2">The text above is what the employee reads first. Their name and the date they agreed are saved — see them with “Responses” on the card.</p>
    </div>
  );
}

const TYPE_NAMES: Record<FeedbackQuestionType, string> = {
  stars: 'Star rating', scale: 'Number scale', text: 'Comment (their own words)', yesno: 'Yes / No', choice: 'Pick one',
};

export function FeedbackBuilder({ config, onChange }: ConfigProps) {
  const questions = config.questions ?? [];
  const setQuestions = (qs: FeedbackQuestion[]) => onChange({ ...config, questions: qs });
  const setQ = (i: number, patch: Partial<FeedbackQuestion>) => setQuestions(questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= questions.length) return;
    const next = [...questions]; [next[i], next[j]] = [next[j], next[i]]; setQuestions(next);
  };
  const addStandard = () => {
    if (questions.length > 0 && !window.confirm('Add the standard questions after yours?')) return;
    setQuestions([...questions, ...standardFeedbackQuestions().map((q) => ({ ...q, id: newQuestionId() }))]);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className={LABEL}>Message at the top (optional)</label>
          <textarea value={config.intro ?? ''} onChange={(e) => onChange({ ...config, intro: e.target.value })} rows={2} placeholder="e.g. Your honest feedback helps us make the training better." className={INPUT} />
        </div>
        <div>
          <label className={LABEL}>“Thank you” message (optional)</label>
          <input value={config.thanks ?? ''} onChange={(e) => onChange({ ...config, thanks: e.target.value })} placeholder="Thank you for your feedback!" className={INPUT} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={config.anonymous === true} onChange={(e) => onChange({ ...config, anonymous: e.target.checked })} />
          Don’t show employees’ names next to their answers in the results
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500">Questions ({questions.length})</p>
        <button type="button" onClick={addStandard} className="text-xs font-semibold text-indigo-600 hover:underline">Use the standard training-feedback questions</button>
      </div>
      {questions.length === 0 && <p className="text-xs text-slate-400">No questions yet — add your own below, or start from the standard ones and change them.</p>}

      {questions.map((q, i) => (
        <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-500">Question {i + 1}</span>
            <span className="flex items-center gap-2">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="rounded px-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === questions.length - 1} aria-label="Move down" className="rounded px-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-30">↓</button>
              <button type="button" onClick={() => setQuestions(questions.filter((_, idx) => idx !== i))} className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
            </span>
          </div>
          <input value={q.label} onChange={(e) => setQ(i, { label: e.target.value })} placeholder="Type the question" className={`${INPUT} mb-2`} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <select value={q.type} onChange={(e) => setQ(i, { type: e.target.value as FeedbackQuestionType, max: e.target.value === 'stars' ? 5 : e.target.value === 'scale' ? 10 : undefined })} className={INPUT}>
              {(Object.keys(TYPE_NAMES) as FeedbackQuestionType[]).map((t) => <option key={t} value={t}>{TYPE_NAMES[t]}</option>)}
            </select>
            {(q.type === 'stars' || q.type === 'scale') && (
              <select value={q.max ?? (q.type === 'stars' ? 5 : 10)} onChange={(e) => setQ(i, { max: Number(e.target.value) })} className={INPUT}>
                {(q.type === 'stars' ? [3, 4, 5, 6, 7, 8, 9, 10] : [3, 4, 5, 6, 7, 8, 9, 10]).map((n) => <option key={n} value={n}>{q.type === 'stars' ? `${n} stars` : `1 to ${n}`}</option>)}
              </select>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={q.required} onChange={(e) => setQ(i, { required: e.target.checked })} /> Must be answered
            </label>
          </div>
          {q.type === 'scale' && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input value={q.low_label ?? ''} onChange={(e) => setQ(i, { low_label: e.target.value })} placeholder="Low end (e.g. Not at all)" className={INPUT} />
              <input value={q.high_label ?? ''} onChange={(e) => setQ(i, { high_label: e.target.value })} placeholder="High end (e.g. Definitely)" className={INPUT} />
            </div>
          )}
          {q.type === 'choice' && (
            <textarea
              value={(q.options ?? []).join('\n')} onChange={(e) => setQ(i, { options: e.target.value.split('\n') })}
              rows={3} placeholder={'One choice per line\nGood\nOkay\nNeeds work'} className={`${INPUT} mt-2`}
            />
          )}
        </div>
      ))}

      <button type="button" onClick={() => setQuestions([...questions, { id: newQuestionId(), type: 'stars', label: '', required: false, max: 5 }])} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
        + Add question
      </button>
    </div>
  );
}

export function TaskSettings({ config, onChange }: ConfigProps) {
  const allowText = config.allow_text !== false;
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-500">How can the employee answer? (the instructions go in the text above)</p>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
        <label className="flex items-center gap-2"><input type="checkbox" checked={allowText} onChange={(e) => onChange({ ...config, allow_text: e.target.checked })} /> Type an answer</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={config.allow_link === true} onChange={(e) => onChange({ ...config, allow_link: e.target.checked })} /> Paste a link</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={config.allow_file === true} onChange={(e) => onChange({ ...config, allow_file: e.target.checked })} /> Upload a file / recording</label>
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" className="mt-0.5" checked={config.must_be_approved === true} onChange={(e) => onChange({ ...config, must_be_approved: e.target.checked })} />
        <span>A reviewer must approve it before the day can be completed <span className="text-slate-400">(if off, sending it is enough — you can still review and comment)</span></span>
      </label>
      <div>
        <label className={LABEL}>Button wording</label>
        <input value={config.submit_label ?? ''} onChange={(e) => onChange({ ...config, submit_label: e.target.value })} placeholder="Submit" className={INPUT} />
      </div>
      {config.allow_file === true && <p className="text-xs text-slate-400">Uploaded files use your storage space — a link (Google Drive, YouTube) is free, so ask for links when files are big.</p>}
    </div>
  );
}

export function ContactSettings({ config, onChange }: ConfigProps) {
  const f = (key: keyof InductionCardConfig, label: string, placeholder: string) => (
    <div>
      <label className={LABEL}>{label}</label>
      <input value={(config[key] as string | undefined) ?? ''} onChange={(e) => onChange({ ...config, [key]: e.target.value })} placeholder={placeholder} className={INPUT} />
    </div>
  );
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {f('name', 'Name', 'e.g. Rohit Sharma')}
      {f('role', 'Role (optional)', 'e.g. Your buddy · Senior Sales Manager')}
      {f('phone', 'Phone (for the Call button)', '+91 98xxxxxxx')}
      {f('whatsapp', 'WhatsApp number (if different)', '+91 98xxxxxxx')}
      <div className="sm:col-span-2">
        <label className={LABEL}>Message (optional)</label>
        <textarea value={config.note ?? ''} onChange={(e) => onChange({ ...config, note: e.target.value })} rows={3} placeholder="e.g. Ask me anything in your first week — no question is too small." className={INPUT} />
      </div>
      <p className="text-xs text-slate-400 sm:col-span-2">The card picture above is shown as this person’s photo. Leave a number empty to hide that button.</p>
    </div>
  );
}
