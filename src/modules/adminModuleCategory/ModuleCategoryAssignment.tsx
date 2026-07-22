// src/modules/adminModuleCategory/ModuleCategoryAssignment.tsx
//
// Lets an Admin fully control Admin Console organization: create,
// rename, and delete categories; assign every real module to whichever
// category they want; and rename any module's display label to match
// their own company's terminology (e.g. "Course Builder" -> "Create
// Course") — all through this screen, no code changes ever needed.

import { useEffect, useState } from 'react';
import {
  loadCategories,
  loadAssignments,
  createCategory,
  saveCategory,
  removeCategory,
  assignModuleToCategory,
  renameModule,
} from '../../services/adminModuleCategory/adminModuleCategoryService';
import { ADMIN_MODULES } from '../../constants/adminModules';
import type { AdminModuleCategory, AdminModuleAssignment } from '../../types/adminModuleCategory';

function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}
function IconPencil({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>);
}
const INPUT_CLS = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';
const UNASSIGNED = '__unassigned__';

function ModuleCategoryAssignment() {
  const [categories, setCategories] = useState<AdminModuleCategory[]>([]);
  const [assignments, setAssignments] = useState<AdminModuleAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [renamingModuleId, setRenamingModuleId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    setError('');
    Promise.all([loadCategories(), loadAssignments()])
      .then(([categoryRows, assignmentRows]) => {
        setCategories(categoryRows);
        setAssignments(assignmentRows);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load data.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;
    setCreatingCategory(true);
    try {
      await createCategory({ category_name: newCategoryName.trim(), display_order: categories.length, active: true });
      setNewCategoryName('');
      fetchAll();
      showToast('Category created');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create category.');
    } finally {
      setCreatingCategory(false);
    }
  }

  async function handleRenameCategory(id: string) {
    if (!editingName.trim()) return;
    setSavingId(id);
    try {
      await saveCategory(id, { category_name: editingName.trim() });
      setEditingId(null);
      fetchAll();
      showToast('Category renamed');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to rename category.');
    } finally {
      setSavingId(null);
    }
  }

  async function handleDeleteCategory(id: string) {
    setSavingId(id);
    try {
      await removeCategory(id);
      fetchAll();
      showToast('Category deleted — its modules moved to Uncategorized.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete category.');
    } finally {
      setSavingId(null);
    }
  }

  async function handleAssign(moduleId: string, categoryId: string) {
    if (categoryId === UNASSIGNED) return;
    setSavingId(moduleId);
    try {
      await assignModuleToCategory(moduleId, categoryId, 0);
      fetchAll();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to assign module.');
    } finally {
      setSavingId(null);
    }
  }

  function startRename(moduleId: string, currentLabel: string) {
    setRenamingModuleId(moduleId);
    setRenameDraft(currentLabel);
  }

  async function handleSaveRename(moduleId: string) {
    setSavingId(moduleId);
    try {
      await renameModule(moduleId, renameDraft, categories[0]?.id ?? '');
      setRenamingModuleId(null);
      fetchAll();
      showToast('Module renamed');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to rename module.');
    } finally {
      setSavingId(null);
    }
  }

  const assignmentByModule = new Map(assignments.map((a) => [a.module_id, a]));
  const searchTerm = search.trim().toLowerCase();
  const filteredModules = ADMIN_MODULES.filter((m) => {
    const displayLabel = assignmentByModule.get(m.id)?.custom_label ?? m.label;
    return !searchTerm || displayLabel.toLowerCase().includes(searchTerm);
  });

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  }
  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Module Categories & Naming</h2>
        <p className="mt-1 text-sm text-slate-500">
          Create categories, sort every module into them, and rename any module to match your own team's language.
          Changes apply immediately across the whole Admin Console — no code, no developer needed.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-700">Categories</p>
        <div className="mb-4 flex gap-2">
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="New category name…"
            className={INPUT_CLS}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
          />
          <button
            onClick={handleCreateCategory}
            disabled={creatingCategory || !newCategoryName.trim()}
            className="flex-shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creatingCategory ? <IconSpinner className="h-3.5 w-3.5" /> : 'Add'}
          </button>
        </div>

        <div className="space-y-2">
          {categories.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-400">No categories yet — add one above.</p>
          ) : (
            categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                {editingId === cat.id ? (
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRenameCategory(cat.id)}
                    className="flex-1 rounded border border-indigo-300 px-2 py-1 text-sm"
                    autoFocus
                  />
                ) : (
                  <span className="text-sm font-medium text-slate-700">{cat.category_name}</span>
                )}
                <div className="flex flex-shrink-0 gap-1.5">
                  {editingId === cat.id ? (
                    <button onClick={() => handleRenameCategory(cat.id)} disabled={savingId === cat.id} className="text-xs font-semibold text-indigo-600 hover:underline">
                      Save
                    </button>
                  ) : (
                    <button onClick={() => { setEditingId(cat.id); setEditingName(cat.category_name); }} className="text-xs font-semibold text-slate-500 hover:text-slate-700">
                      Rename
                    </button>
                  )}
                  <button onClick={() => handleDeleteCategory(cat.id)} disabled={savingId === cat.id} className="text-xs font-semibold text-red-500 hover:text-red-700">
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Modules — Rename & Assign to a Category</p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search modules…"
          className={`${INPUT_CLS} mb-3`}
        />
        <div className="max-h-[28rem] space-y-1.5 overflow-y-auto">
          {filteredModules.map((mod) => {
            const assignment = assignmentByModule.get(mod.id);
            const displayLabel = assignment?.custom_label ?? mod.label;
            const isRenaming = renamingModuleId === mod.id;

            return (
              <div key={mod.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-slate-50">
                {isRenaming ? (
                  <div className="flex flex-1 items-center gap-2">
                    <input
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(mod.id)}
                      className="flex-1 rounded border border-indigo-300 px-2 py-1 text-sm"
                      autoFocus
                    />
                    <button onClick={() => handleSaveRename(mod.id)} disabled={savingId === mod.id} className="text-xs font-semibold text-indigo-600 hover:underline">
                      Save
                    </button>
                    <button onClick={() => setRenamingModuleId(null)} className="text-xs font-semibold text-slate-400 hover:text-slate-600">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startRename(mod.id, displayLabel)}
                    className="flex flex-1 items-center gap-1.5 text-left text-sm text-slate-700 hover:text-indigo-600"
                  >
                    {displayLabel}
                    <IconPencil className="h-3 w-3 text-slate-300" />
                  </button>
                )}

                <select
                  value={assignment?.category_id ?? UNASSIGNED}
                  onChange={(e) => handleAssign(mod.id, e.target.value)}
                  disabled={savingId === mod.id || categories.length === 0}
                  className="w-56 flex-shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                >
                  <option value={UNASSIGNED}>Uncategorized</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.category_name}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default ModuleCategoryAssignment;
