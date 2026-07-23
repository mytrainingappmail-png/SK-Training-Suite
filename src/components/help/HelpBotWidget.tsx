// A lightweight, always-available chat-style assistant that searches the
// real Help Center articles (src/services/help/helpArticleService.ts) —
// deliberately NOT wired to an external AI API. That would need a paid
// LLM key (same kind of setup step Resend needed) and ongoing per-message
// cost; this gives an instant, free "ask a question" experience today by
// reusing content that already exists, with a fallback to a real human
// (raise a ticket) when nothing matches.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadArticles, searchArticles } from '../../services/help/helpArticleService';
import { useAuthorization } from '../../hooks/useAuthorization';
import { ROUTES } from '../../constants/routes';
import type { HelpArticle } from '../../types/helpArticle';

interface ChatEntry {
  id: string;
  from: 'user' | 'bot';
  text?: string;
  matches?: HelpArticle[];
}

function IconChat({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" />
    </svg>
  );
}
function IconX({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}

function HelpBotWidget() {
  const navigate = useNavigate();
  const { can, PERMISSIONS } = useAuthorization();
  const [open, setOpen] = useState(false);
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [question, setQuestion] = useState('');
  const [entries, setEntries] = useState<ChatEntry[]>([
    { id: 'greeting', from: 'bot', text: 'Hi! Ask me anything about using the app — I will search the Help Center for you.' },
  ]);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !loaded) {
      loadArticles().then((rows) => { setArticles(rows.filter((a) => a.status === 'published')); setLoaded(true); }).catch(() => setLoaded(true));
    }
  }, [open, loaded]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [entries]);

  function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    const matches = searchArticles(articles, q).slice(0, 3);
    setEntries((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, from: 'user', text: q },
      { id: `b-${Date.now()}`, from: 'bot', matches },
    ]);
    setQuestion('');
  }

  // Help Center is admin-facing now, not employee self-service — hide the
  // floating bot for anyone who can't see the Help Center itself.
  if (!can(PERMISSIONS.VIEW_HELP_CENTER)) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {open && (
        <div className="mb-3 flex h-[420px] w-80 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
          <div className="flex items-center justify-between px-4 py-3 text-white" style={{ backgroundColor: '#0F172A' }}>
            <span className="text-sm font-semibold">Help Assistant</span>
            <button onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-white/10"><IconX className="h-4 w-4" /></button>
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {entries.map((entry) => (
              <div key={entry.id} className={entry.from === 'user' ? 'ml-auto max-w-[85%] rounded-xl bg-slate-900 px-3 py-2 text-sm text-white' : 'max-w-[90%] space-y-2'}>
                {entry.text && (
                  <p className={entry.from === 'bot' ? 'rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700' : ''}>{entry.text}</p>
                )}
                {entry.matches && entry.matches.length > 0 && (
                  <div className="space-y-1.5">
                    {entry.matches.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => navigate(ROUTES.HELP_CENTER)}
                        className="block w-full rounded-lg bg-indigo-50 px-3 py-2 text-left text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        {m.title}
                      </button>
                    ))}
                  </div>
                )}
                {entry.matches && entry.matches.length === 0 && (
                  <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    I couldn't find an article for that.{' '}
                    <button onClick={() => navigate(ROUTES.MY_TICKETS)} className="font-semibold underline">Raise a support ticket</button> instead.
                  </div>
                )}
              </div>
            ))}
            {open && !loaded && <p className="text-xs text-slate-400">Loading the guide…</p>}
          </div>

          <form onSubmit={handleAsk} className="flex items-center gap-2 border-t border-slate-100 p-3">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. how do I create a course?"
              className="w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
            <button type="submit" className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">Ask</button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-xl transition hover:scale-105"
        style={{ backgroundColor: '#D4AF37' }}
        aria-label="Open help assistant"
      >
        {open ? <IconX /> : <IconChat />}
      </button>
    </div>
  );
}

export default HelpBotWidget;
