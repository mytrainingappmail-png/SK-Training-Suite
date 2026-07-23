import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SectionHeroBanner from '../learning/SectionHeroBanner';
import { getCurrentUser } from '../../services/auth/session';
import { loadCompany } from '../../services/company/companyService';
import { loadArticles, createArticle, updateArticle, deleteArticle, searchArticles } from '../../services/help/helpArticleService';
import { HELP_CATEGORIES } from '../../types/helpArticle';
import type { HelpArticle, HelpArticleStatus } from '../../types/helpArticle';
import { ROUTES } from '../../constants/routes';

const INPUT_CLS = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';

function categoryLabel(value: string): string {
  return HELP_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

// Same native execCommand technique used throughout this app's editors
// (EmailTemplateBuilder, ContentEditor) — no new dependency.
function RichHtmlEditor({ html, onChange }: { html: string; onChange: (html: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (editorRef.current && !initializedRef.current) {
      editorRef.current.innerHTML = html;
      initializedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1 rounded-xl bg-slate-50 p-1.5">
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('bold'); }} className="rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-600 hover:bg-white hover:shadow-sm">B</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('italic'); }} className="rounded-lg px-2.5 py-1.5 text-sm italic text-slate-600 hover:bg-white hover:shadow-sm">I</button>
        <span className="mx-1 h-6 w-px bg-slate-200" />
        <select onMouseDown={(e) => e.stopPropagation()} onChange={(e) => exec('formatBlock', e.target.value)} defaultValue="<p>" className="h-8 rounded-lg bg-white px-2 text-xs text-slate-700 shadow-sm">
          <option value="<p>">Text</option>
          <option value="<h2>">Heading</option>
        </select>
        <span className="mx-1 h-6 w-px bg-slate-200" />
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }} className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-white hover:shadow-sm">• List</button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec('insertOrderedList'); }} className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-white hover:shadow-sm">1. List</button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        className="prose prose-slate min-h-[220px] max-w-none rounded-xl bg-slate-50 p-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
      />
    </div>
  );
}

function ArticleEditor({ article, onClose, onSaved }: {
  article: HelpArticle | 'new';
  onClose: () => void;
  onSaved: (a: HelpArticle) => void;
}) {
  const user = getCurrentUser();
  const isNew = article === 'new';
  const [title, setTitle] = useState(isNew ? '' : article.title);
  const [category, setCategory] = useState(isNew ? HELP_CATEGORIES[0].value : article.category);
  const [keywords, setKeywords] = useState(isNew ? '' : article.keywords);
  const [status, setStatus] = useState<HelpArticleStatus>(isNew ? 'draft' : article.status);
  const [contentHtml, setContentHtml] = useState(isNew ? '<p>Write the guide here…</p>' : article.content_html);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave() {
    if (!title.trim()) {
      setError('Please give the article a title.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const form = { title: title.trim(), category, keywords: keywords.trim(), status, content_html: contentHtml, display_order: isNew ? 0 : article.display_order };
      const saved = isNew
        ? await createArticle(user?.id ?? null, `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(), form)
        : await updateArticle(article.id, form);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save article.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-4 text-lg font-bold text-slate-900">{isNew ? 'New Help Article' : 'Edit Help Article'}</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={INPUT_CLS}>
              {HELP_CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Search Keywords (comma separated, optional)</label>
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} className={INPUT_CLS} placeholder="e.g. quiz, exam, test" />
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Content</label>
          <RichHtmlEditor html={contentHtml} onChange={setContentHtml} />
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex items-center justify-between">
          <select value={status} onChange={(e) => setStatus(e.target.value as HelpArticleStatus)} className={`${INPUT_CLS} w-40`}>
            <option value="draft">Draft (hidden)</option>
            <option value="published">Published</option>
          </select>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/70 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HelpCenter() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isOperator, setIsOperator] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingArticle, setEditingArticle] = useState<HelpArticle | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HelpArticle | null>(null);

  function fetchAll() {
    setLoading(true);
    setError('');
    Promise.all([loadArticles(), loadCompany()])
      .then(([articleRows, company]) => {
        setArticles(articleRows);
        setIsOperator(company?.is_platform_operator ?? false);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load the help center.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  const visibleArticles = useMemo(() => articles.filter((a) => a.status === 'published' || isOperator), [articles, isOperator]);
  const categoriesPresent = useMemo(
    () => HELP_CATEGORIES.filter((c) => visibleArticles.some((a) => a.category === c.value)),
    [visibleArticles]
  );
  const searched = useMemo(() => searchArticles(visibleArticles, search), [visibleArticles, search]);
  const filtered = useMemo(
    () => (activeCategory ? searched.filter((a) => a.category === activeCategory) : searched),
    [searched, activeCategory]
  );
  const selected = articles.find((a) => a.id === selectedId) ?? filtered[0] ?? null;

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    await deleteArticle(deleteTarget.id);
    setArticles((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    if (selectedId === deleteTarget.id) setSelectedId(null);
    setDeleteTarget(null);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }
  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <SectionHeroBanner
        title="Help Center"
        subtitle="A guide to every feature — courses, assessments, certificates, and more."
        statLabel="Articles"
        statValue={visibleArticles.length}
      />

      <div className="flex flex-wrap items-center gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search the guide…" className={`${INPUT_CLS} max-w-md`} />
        {isOperator && (
          <button onClick={() => setEditingArticle('new')} className="ml-auto rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm" style={{ backgroundColor: '#0F172A' }}>
            + New Article
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
        <div className="space-y-1 rounded-2xl bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:h-fit">
          <button
            onClick={() => setActiveCategory(null)}
            className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${activeCategory === null ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            All Topics
          </button>
          {categoriesPresent.map((c) => (
            <button
              key={c.value}
              onClick={() => setActiveCategory(c.value)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${activeCategory === c.value ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[260px_1fr]">
          <div className="space-y-1 rounded-2xl bg-white p-3 shadow-sm">
            {filtered.length === 0 ? (
              <p className="p-3 text-sm text-slate-400">No articles match your search.</p>
            ) : (
              filtered.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  className={`flex w-full flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left transition ${selected?.id === a.id ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-50'}`}
                >
                  <span className="truncate text-sm font-semibold text-slate-800">{a.title}</span>
                  <span className="truncate text-xs text-slate-400">
                    {categoryLabel(a.category)}{a.status === 'draft' ? ' · Draft' : ''}
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            {!selected ? (
              <p className="text-sm text-slate-400">Select an article to read it.</p>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-indigo-500">{categoryLabel(selected.category)}</span>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">{selected.title}</h2>
                  </div>
                  {isOperator && (
                    <div className="flex gap-2">
                      <button onClick={() => setEditingArticle(selected)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">Edit</button>
                      <button onClick={() => setDeleteTarget(selected)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100">Delete</button>
                    </div>
                  )}
                </div>
                <div className="prose prose-slate max-w-none text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: selected.content_html }} />
                <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                  Still stuck? <button onClick={() => navigate(ROUTES.MY_TICKETS)} className="font-semibold text-indigo-600 hover:underline">Raise a support ticket</button> and your admin team will help directly.
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {editingArticle && (
        <ArticleEditor
          article={editingArticle}
          onClose={() => setEditingArticle(null)}
          onSaved={(saved) => {
            setArticles((prev) => (prev.some((a) => a.id === saved.id) ? prev.map((a) => (a.id === saved.id ? saved : a)) : [saved, ...prev]));
            setSelectedId(saved.id);
          }}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDeleteTarget(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold text-slate-900">Delete Article</h3>
            <p className="mb-5 text-sm text-slate-500">Delete "{deleteTarget.title}"? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/70 hover:bg-slate-50">Cancel</button>
              <button onClick={handleDeleteConfirm} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default HelpCenter;
