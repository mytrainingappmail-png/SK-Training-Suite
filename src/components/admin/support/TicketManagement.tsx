import { useEffect, useState } from 'react';
import { getCurrentUser } from '../../../services/auth/session';
import PlatformSupportPanel from './PlatformSupportPanel';
import {
  loadCompanyTickets, replyToTicket, changeTicketStatus,
} from '../../../services/support/supportTicketService';
import { useTicketMessages } from '../../../hooks/useTicketMessages';
import { employeeService } from '../../../services/employee/employeeService';
import { TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES } from '../../../types/supportTicket';
import type { SupportTicket, TicketStatus } from '../../../types/supportTicket';
import type { Employee } from '../../../types/employee';

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

function TicketDrawer({
  ticket, employeeById, onClose, onStatusChanged,
}: {
  ticket: SupportTicket;
  employeeById: Map<string, Employee>;
  onClose: () => void;
  onStatusChanged: (t: SupportTicket) => void;
}) {
  const admin = getCurrentUser();
  const raiser = employeeById.get(ticket.employee_id);
  const { messages, loading, appendLocal } = useTicketMessages(ticket.id);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [savingStatus, setSavingStatus] = useState(false);

  async function handleReply() {
    if (!admin || !reply.trim() || sending) return;
    setSending(true);
    try {
      const saved = await replyToTicket(
        ticket,
        admin.id,
        `${admin.firstName} ${admin.lastName}`.trim(),
        true,
        reply.trim(),
        raiser?.email,
        raiser?.first_name
      );
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
              {raiser ? `${raiser.first_name} ${raiser.last_name} (${raiser.employee_code})` : 'Unknown employee'} ·{' '}
              {TICKET_CATEGORIES.find((c) => c.value === ticket.category)?.label} ·{' '}
              <span className={`rounded-full px-2 py-0.5 ${PRIORITY_STYLES[ticket.priority]}`}>{TICKET_PRIORITIES.find((p) => p.value === ticket.priority)?.label}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select value={status} onChange={(e) => handleStatusChange(e.target.value as TicketStatus)} disabled={savingStatus} className="rounded-lg bg-slate-50 px-2 py-1.5 text-xs font-semibold text-slate-700">
              {TICKET_STATUSES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
            </select>
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
                <p className="mb-1 text-xs font-semibold opacity-70">{m.author_name}{m.is_admin_reply ? ' (Admin)' : ''}</p>
                <p>{m.message}</p>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-100 p-4">
          <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to this ticket…" className={INPUT_CLS}
            onKeyDown={(e) => { if (e.key === 'Enter') handleReply(); }} />
          <button onClick={handleReply} disabled={sending || !reply.trim()} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Reply</button>
        </div>
      </div>
    </div>
  );
}

function TicketManagement() {
  const [view, setView] = useState<'company' | 'platform'>('company');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TicketStatus>('all');
  const [search, setSearch] = useState('');
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);

  function fetchAll() {
    setLoading(true);
    setError('');
    Promise.all([loadCompanyTickets(), employeeService.getAll()])
      .then(([ticketRows, employeeRows]) => {
        setTickets(ticketRows);
        setEmployees(employeeRows);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load tickets.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
  }, []);

  const employeeById = new Map(employees.map((e) => [e.id, e]));

  const viewToggle = (
    <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
      <button
        onClick={() => setView('company')}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${view === 'company' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
      >
        Company Tickets
      </button>
      <button
        onClick={() => setView('platform')}
        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${view === 'platform' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
      >
        Platform Support
      </button>
    </div>
  );

  if (view === 'platform') {
    return (
      <div className="space-y-6">
        {viewToggle}
        <PlatformSupportPanel />
      </div>
    );
  }

  const filtered = tickets.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    const term = search.trim().toLowerCase();
    if (!term) return true;
    const raiser = employeeById.get(t.employee_id);
    return (
      t.subject.toLowerCase().includes(term) ||
      (raiser && `${raiser.first_name} ${raiser.last_name}`.toLowerCase().includes(term))
    );
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-14 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (error) {
    return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {viewToggle}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-400">Ticket Management</h2>
        <div className="flex flex-wrap gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search subject or employee…" className={`${INPUT_CLS} w-56`} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | TicketStatus)} className={INPUT_CLS}>
            <option value="all">All Statuses</option>
            {TICKET_STATUSES.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
          <p className="font-medium">No tickets match this view.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const raiser = employeeById.get(t.employee_id);
            return (
              <button
                key={t.id}
                onClick={() => setActiveTicket(t)}
                className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 text-left shadow-sm transition hover:shadow-md"
              >
                <div>
                  <p className="font-semibold text-slate-800">{t.subject}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {raiser ? `${raiser.first_name} ${raiser.last_name} (${raiser.employee_code})` : 'Unknown'} · {new Date(t.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PRIORITY_STYLES[t.priority]}`}>{TICKET_PRIORITIES.find((p) => p.value === t.priority)?.label}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {activeTicket && (
        <TicketDrawer
          ticket={activeTicket}
          employeeById={employeeById}
          onClose={() => { setActiveTicket(null); fetchAll(); }}
          onStatusChanged={(updated) => setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))}
        />
      )}
    </div>
  );
}

export default TicketManagement;
