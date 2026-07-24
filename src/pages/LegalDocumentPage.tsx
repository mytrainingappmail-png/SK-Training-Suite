// A genuinely public page — no login required, reachable by a
// prospective Subscribing Company or a Trainee before they ever sign in.
// Intentionally standalone (no sidebar/header), just the document content.

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { loadDocument } from '../services/legal/legalDocumentService';
import { ROUTES } from '../constants/routes';
import type { LegalDocument } from '../types/legalDocument';

function LegalDocumentPage() {
  const { slug } = useParams<{ slug: string }>();
  const [doc, setDoc] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    loadDocument(slug)
      .then((d) => {
        if (!d) setError('This document could not be found.');
        setDoc(d);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <Link to={ROUTES.LOGIN} className="mb-6 inline-block text-sm font-semibold text-indigo-600 hover:underline">
          ← Back to Login
        </Link>

        {loading && <div className="h-64 animate-pulse rounded-2xl bg-white shadow-sm" />}

        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-600">{error}</div>
        )}

        {!loading && doc && (
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <h1 className="mb-1 text-2xl font-bold text-slate-900">{doc.title}</h1>
            <p className="mb-6 text-xs text-slate-400">
              Last updated {new Date(doc.updated_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <div
              className="prose prose-sm max-w-none leading-relaxed text-slate-700"
              dangerouslySetInnerHTML={{ __html: doc.content_html }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default LegalDocumentPage;
