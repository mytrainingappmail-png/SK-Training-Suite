import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { loadTicketMessages } from '../services/support/supportTicketService';
import type { SupportTicketMessage } from '../types/supportTicket';

/**
 * Loads a ticket's message thread and keeps it live via Supabase Realtime —
 * shared by every ticket-thread view (employee MyTickets, admin Ticket
 * Management, Platform Support) so a reply from the other side appears
 * without a manual refresh. RLS still governs which rows a given session
 * can ever receive, same as the initial fetch.
 */
export function useTicketMessages(ticketId: string) {
  const [messages, setMessages] = useState<SupportTicketMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    loadTicketMessages(ticketId)
      .then((rows) => { if (!cancelled) setMessages(rows); })
      .finally(() => { if (!cancelled) setLoading(false); });

    const channel = supabase
      .channel(`ticket-messages-${ticketId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_ticket_messages', filter: `ticket_id=eq.${ticketId}` },
        (payload) => {
          const row = payload.new as SupportTicketMessage;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  function appendLocal(message: SupportTicketMessage) {
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
  }

  return { messages, loading, appendLocal };
}
