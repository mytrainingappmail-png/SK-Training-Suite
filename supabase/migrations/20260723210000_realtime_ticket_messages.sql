-- Enables live updates on ticket reply threads (employee MyTickets, admin
-- Ticket Management, Platform Support) without a manual refresh. Realtime
-- still respects the existing RLS policies on support_ticket_messages, so
-- the same company-scoping / platform-operator cross-company rules apply
-- to live events too — nothing new to secure here.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'support_ticket_messages'
  ) then
    alter publication supabase_realtime add table support_ticket_messages;
  end if;
end $$;
