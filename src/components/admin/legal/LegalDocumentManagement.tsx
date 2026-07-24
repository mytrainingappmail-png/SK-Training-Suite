import { useEffect, useState } from 'react';
import { loadAllDocuments, saveDocumentContent } from '../../../services/legal/legalDocumentService';
import { uploadImage } from '../../../services/contentEditor/contentEditorService';
import RichTextEditor from '../../shared/RichTextEditor';
import type { LegalDocument } from '../../../types/legalDocument';

async function uploadInlineImage(file: File): Promise<string> {
  const { url } = await uploadImage(file);
  return url;
}

function LegalDocumentManagement() {
  const [docs, setDocs] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftHtml, setDraftHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    loadAllDocuments()
      .then(setDocs)
      .catch((err: unknown) => showToast(err instanceof Error ? err.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchAll(); }, []);

  function startEdit(doc: LegalDocument) {
    setEditingId(doc.id);
    setDraftHtml(doc.content_html);
  }

  async function handleSave() {
    if (!editingId) return;
    setSaving(true);
    try {
      await saveDocumentContent(editingId, draftHtml);
      setEditingId(null);
      fetchAll();
      showToast('Saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  }

  const editingDoc = docs.find((d) => d.id === editingId);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Legal Documents</h2>
        <p className="mt-1 text-sm text-slate-500">
          Terms &amp; Conditions and Privacy Policy — publicly viewable (no login needed) at /legal/terms-of-service and /legal/privacy-policy, linked from the login page.
        </p>
        <p className="mt-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
          These are general starting-point drafts, not legal advice — have a lawyer review them before relying on them.
        </p>
      </div>

      {editingDoc ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-bold text-slate-900">Editing: {editingDoc.title}</h3>
          <RichTextEditor
            value={draftHtml}
            onChange={setDraftHtml}
            onImageUpload={uploadInlineImage}
            minHeight={400}
            resetKey={editingDoc.id}
          />
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setEditingId(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="space-y-2">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{doc.title}</p>
                  <p className="text-xs text-slate-400">Updated {new Date(doc.updated_at).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                  <a href={`/legal/${doc.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-slate-500 hover:underline">View</a>
                  <button onClick={() => startEdit(doc)} className="text-xs font-semibold text-indigo-600 hover:underline">Edit</button>
                </div>
              </div>
            ))}
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

export default LegalDocumentManagement;
