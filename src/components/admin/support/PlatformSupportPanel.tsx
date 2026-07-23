import { useEffect, useState } from 'react';
import { getCurrentUser } from '../../../services/auth/session';
import { loadCompany } from '../../../services/company/companyService';
import {
  loadPlatformTickets, raisePlatformTicket, replyToTicket, changeTicketStatus,
} from '../../../services/support/supportTicketService';
import { useTicketMessages } from '../../../hooks/useTicketMessages';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from '../../../types/supportTicket';
import type { SupportTicket, TicketCategory, TicketPriority, TicketStatus } from '../../../types/supportTicket';

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  in_progress: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  resolved: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  closed: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
};
const STATUS_LABEL: Record<string, string> = {
  open: 'Open', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed',
};
const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-slate-100 text-slate-500',
  normal: 'bg-indigo-50 text-indigo-600',
  high: 'bg-orange-50 text-orange-600',
  urgent: 'bg-red-50 text-red-600',
};
const INPUT_CLS = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';

function RaisePlatformTicketModal({ companyId, companyName, onClose, onCreated }: {
  companyId: string; companyName: string; onClose: () => void; onCreated: (t: SupportTicket) => void;
}) {
  const user = getCurrentUser();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('billing');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || submitting) return;
    if (!subject.trim() || !description.trim()) {
      setError('Please fill in both the subject and description.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const ticket = await raisePlatformTicket(companyId, companyName, user.id, `${user.firstName} ${user.lastName}`.trim(), {
        subject: subject.trim(), description: description.trim(), category, priority,
      });
      onCreated(ticket);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to raise ticket.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative z-10 w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Raise a Platform Support Ticket</h3>
          <p className="mt-1 text-xs text-slate-400">Billing, subscription, or platform-level problems go straight to the SK Enterprise team.</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary of the issue" className={INPUT_CLS} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as TicketCategory)} className={INPUT_CLS}>
              {TICKET_CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Priority</label>
            <select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)} className={INPUT_CLS}>
              {TICKET_PRIORITIES.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Describe the problem</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={`${INPUT_CLS} resize-none`} placeholder="What happened, what you need, or what to bill/change." />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/70 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={submitting} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-50" style={{ backgroundColor: '#0F172A' }}>
            {submitting ? 'Submitting…' : 'Submit to Platform Support'}
          </button>
        </div>
      </form>
    </div>
  );
}

function PlatformTicketDrawer({
  ticket, isAdminReply, onClose, onStatusChanged,
}: {
  ticket: SupportTicket;
  isAdminReply: boolean;
  onClose: () => void;
  onStatusChanged: (t: SupportTicket) => void;
}) {
  const user = getCurrentUser();
  const { messages, loading, appendLocal } = useTicketMessages(ticket.id);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [savingStatus, setSavingStatus] = useState(false);

  async function handleReply() {
    if (!user || !reply.trim() || sending) return;
    setSending(true);
    try {
      const saved = await replyToTicket(ticket, user.id, `${user.firstName} ${user.lastName}`.trim(), isAdminReply, reply.trim());
      appendLocal(saved);
      setReply('');
    } finally {
      setSending(false);
    }
  }

  async function handleStatusChange(next: TicketStatus) {
    setStatus(next);
    setSavingStatus(true);
    try {
      const updated = await changeTicketStatus(ticket.id, next);
      onStatusChanged(updated);
    } finally {
      setSavingStatus(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <p className="text-sm font-bold text-slate-900">{ticket.subject}</p>
            <p className="mt-1 text-xs text-slate-400">
              {ticket.raiser_name} at {ticket.raiser_company_name} ·{' '}
              {TICKET_CATEGORIES.find((c) => c.value === ticket.category)?.label} ·{' '}
              <span className={`rounded-full px-2 py-0.5 ${PRIORITY_STYLES[ticket.priority]}`}>{TICKET_PRIORITIES.find((p) => p.value === ticket.priority)?.label}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isAdminReply && (
              <select value={status} onChange={(e) => handleStatusChange(e.target.value as TicketStatus)} disabled={savingStatus} className="rounded-lg bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700">
                {TICKET_STATUSES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
              </select>
            )}
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">✕</button>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{ticket.description}</div>
          {loading ? (
            <p className="text-sm text-slate-400">Loading replies…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-slate-400">No replies yet.</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`max-w-[85%] rounded-xl p-3 text-sm ${m.is_admin_reply ? 'ml-auto bg-slate-900 text-white' : 'bg-indigo-50 text-indigo-900'}`}>
                <p className="mb-1 text-xs font-semibold opacity-70">{m.author_name}{m.is_admin_reply ? ' (Platform Support)' : ''}</p>
                <p>{m.message}</p>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 p-4">
          <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply…" className={INPUT_CLS}
            onKeyDown={(e) => { if (e.key === 'Enter') handleReply(); }} />
          <button onClick={handleReply} disabled={sending || !reply.trim()} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Reply</button>
        </div>
      </div>
    </div>
  );
}

function PlatformSupportPanel() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isOperator, setIsOperator] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TicketStatus>('all');
  const [showRaise, setShowRaise] = useState(false);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);

  function fetchAll() {
    setLoading(true);
    setError('');
    Promise.all([loadCompany(), loadPlatformTickets()])
      .then(([company, ticketRows]) => {
        setIsOperator(company?.is_platform_operator ?? false);
        setCompanyId(company?.id ?? '');
        setCompanyName(company?.company_name ?? '');
        setTickets(ticketRows);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load platform tickets.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  const filtered = tickets.filter((t) => statusFilter === 'all' || t.status === statusFilter);

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />;
  }
  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">
            {isOperator ? 'Platform Support Inbox' : 'Platform Support'}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {isOperator
              ? 'Billing, subscription, and platform-level tickets raised by every client company.'
              : 'Contact the SK Enterprise team about billing, subscription, or platform-level problems.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | TicketStatus)} className={INPUT_CLS}>
            <option value="all">All Statuses</option>
            {TICKET_STATUSES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
          </select>
          {!isOperator && (
            <button onClick={() => setShowRaise(true)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm" style={{ backgroundColor: '#0F172A' }}>
              + Raise a Platform Ticket
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
          <p className="font-medium">{isOperator ? 'No platform tickets from any company yet.' : 'No platform tickets yet.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTicket(t)}
              className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 text-left shadow-sm transition hover:shadow-md"
            >
              <div>
                <p className="font-semibold text-slate-800">{t.subject}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {t.raiser_name} at {t.raiser_company_name} · {new Date(t.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_STYLES[t.priority]}`}>{TICKET_PRIORITIES.find((p) => p.value === t.priority)?.label}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[t.status]}`}>{STATUS_LABEL[t.status]}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {showRaise && (
        <RaisePlatformTicketModal companyId={companyId} companyName={companyName} onClose={() => setShowRaise(false)} onCreated={(t) => setTickets((prev) => [t, ...prev])} />
      )}
      {activeTicket && (
        <PlatformTicketDrawer
          ticket={activeTicket}
          isAdminReply={isOperator}
          onClose={() => { setActiveTicket(null); fetchAll(); }}
          onStatusChanged={(updated) => setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))}
        />
      )}
    </div>
  );
}

export default PlatformSupportPanel;
