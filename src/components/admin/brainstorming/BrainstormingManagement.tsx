import { useEffect, useState } from 'react';
import { loadItems, saveItem, editItem, removeItem } from '../../../services/brainstorming/brainstormingService';
import type { BrainstormingItem, BrainstormingItemForm } from '../../../types/brainstorming';
import { defaultBrainstormingItemForm } from '../../../types/brainstorming';

const INPUT_CLS = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';

function BrainstormingManagement() {
  const [items, setItems] = useState<BrainstormingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BrainstormingItemForm>(defaultBrainstormingItemForm);
  const [saving, setSaving] = useState(false);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    loadItems()
      .then(setItems)
      .catch((err: unknown) => showToast(err instanceof Error ? err.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchAll(); }, []);

  function startNew() {
    setEditingId('new');
    setDraft({ ...defaultBrainstormingItemForm, display_order: items.length });
  }

  function startEdit(item: BrainstormingItem) {
    setEditingId(item.id);
    setDraft({
      question: item.question,
      answer: item.answer,
      category: item.category,
      difficulty: item.difficulty,
      active: item.active,
      display_order: item.display_order,
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingId === 'new') {
        await saveItem(draft);
      } else if (editingId) {
        await editItem(editingId, draft);
      }
      setEditingId(null);
      fetchAll();
      showToast('Saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await removeItem(id);
      fetchAll();
      showToast('Deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete.');
    }
  }

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Brainstorming</h2>
        <p className="mt-1 text-sm text-slate-500">Puzzles and riddles for employee engagement — no scoring, shared across every company.</p>
      </div>

      {editingId ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-bold text-slate-900">{editingId === 'new' ? 'New Puzzle' : 'Edit Puzzle'}</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Question</label>
              <textarea value={draft.question} onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))} rows={2} className={INPUT_CLS} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Answer</label>
              <textarea value={draft.answer} onChange={(e) => setDraft((d) => ({ ...d, answer: e.target.value }))} rows={2} className={INPUT_CLS} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Category</label>
                <input value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} placeholder="e.g. Riddles, Logic, Sales Puzzle" className={INPUT_CLS} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Difficulty</label>
                <select value={draft.difficulty} onChange={(e) => setDraft((d) => ({ ...d, difficulty: e.target.value as BrainstormingItemForm['difficulty'] }))} className={INPUT_CLS}>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))} />
              Active (visible to employees)
            </label>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setEditingId(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Puzzle'}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">All Puzzles</p>
            <button onClick={startNew} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">+ New Puzzle</button>
          </div>
          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No puzzles yet — add one above.</p>
            ) : (
              items.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{item.question}</p>
                    <p className="text-xs text-slate-400">{item.category} · {item.difficulty} · {item.active ? 'Active' : 'Inactive'}</p>
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <button onClick={() => startEdit(item)} className="text-xs font-semibold text-indigo-600 hover:underline">Edit</button>
                    <button onClick={() => handleDelete(item.id)} className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>
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

export default BrainstormingManagement;
