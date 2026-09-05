import { useMemo, useState } from "react";

import * as dataRepo from "../../repositories/callingApp/callingAppDataRepository";
import type { CallingAppIdentity } from "./CallingAppShell";
import type { CallingAppContact, CallingAppHandoff, CallingAppAdmin, HandoffStatus } from "../../types/callingApp";

const STATUS_STYLES: Record<HandoffStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  accepted: "bg-emerald-100 text-emerald-700",
  declined: "bg-rose-100 text-rose-700",
};

function HandoffRow({
  handoff,
  contact,
  adminById,
  showFrom,
  showTo,
  actions,
}: {
  handoff: CallingAppHandoff;
  contact: CallingAppContact | undefined;
  adminById: Map<string, CallingAppAdmin>;
  showFrom: boolean;
  showTo: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-slate-800">{contact?.name ?? "Unknown contact"} <span className="font-normal text-slate-600">· {contact?.mobile_no}</span></p>
        <p className="mt-0.5 text-xs text-slate-600">
          {showFrom && <>From {adminById.get(handoff.from_admin_id)?.display_name ?? "someone"} </>}
          {showFrom && showTo && "→ "}
          {showTo && <>To {adminById.get(handoff.to_admin_id)?.display_name ?? "someone"}</>}
        </p>
        {handoff.note && <p className="mt-1 text-xs italic text-slate-600">"{handoff.note}"</p>}
      </div>
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[handoff.status]}`}>{handoff.status}</span>
        {actions}
      </div>
    </div>
  );
}

export function CallingAppProspectsTab({
  identity,
  contacts,
  handoffs,
  teamAdmins,
  scopeAdminIds,
  onChanged,
  showToast,
}: {
  identity: CallingAppIdentity;
  contacts: CallingAppContact[];
  handoffs: CallingAppHandoff[];
  teamAdmins: CallingAppAdmin[];
  scopeAdminIds: Set<string>;
  onChanged: () => void;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const { admin, client } = identity;
  const [busyId, setBusyId] = useState<string | null>(null);
  const isTeamView = scopeAdminIds.size > 1;

  const contactById = useMemo(() => new Map(contacts.map((c) => [c.id, c])), [contacts]);
  const adminById = useMemo(() => new Map(teamAdmins.map((a) => [a.id, a])), [teamAdmins]);

  const incoming = useMemo(() => handoffs.filter((h) => h.to_admin_id === admin.id && h.status === "pending"), [handoffs, admin.id]);
  const outgoing = useMemo(() => handoffs.filter((h) => h.from_admin_id === admin.id), [handoffs, admin.id]);
  const teamHandoffs = useMemo(
    () => (isTeamView ? handoffs.filter((h) => scopeAdminIds.has(h.from_admin_id) || scopeAdminIds.has(h.to_admin_id)) : []),
    [isTeamView, handoffs, scopeAdminIds]
  );
  const prospectContacts = useMemo(
    () => contacts.filter((c) => c.is_prospect && c.assigned_to && (admin.is_admin ? true : scopeAdminIds.has(c.assigned_to))).sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [contacts, admin.is_admin, scopeAdminIds]
  );

  async function handleAccept(handoffId: string) {
    setBusyId(handoffId);
    try {
      await dataRepo.acceptHandoff(client, handoffId);
      showToast("Handoff accepted — the contact is now on your sheet.");
      onChanged();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not accept the handoff.", false);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDecline(handoffId: string) {
    setBusyId(handoffId);
    try {
      await dataRepo.declineHandoff(client, handoffId, "");
      showToast("Handoff declined.");
      onChanged();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not decline the handoff.", false);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
        Mark a lead as a Prospect and request a handoff right from the <span className="font-semibold">Call & Log</span> dialog in the Calling Sheet — this tab is where you review requests and see who's escalating what.
      </div>

      {incoming.length > 0 && (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-slate-900">🔔 Incoming Handoff Requests ({incoming.length})</h3>
          <div className="space-y-2">
            {incoming.map((h) => (
              <HandoffRow
                key={h.id}
                handoff={h}
                contact={contactById.get(h.contact_id)}
                adminById={adminById}
                showFrom
                showTo={false}
                actions={
                  <div className="flex gap-2">
                    <button onClick={() => handleAccept(h.id)} disabled={busyId === h.id} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Accept</button>
                    <button onClick={() => handleDecline(h.id)} disabled={busyId === h.id} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Decline</button>
                  </div>
                }
              />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-bold text-slate-900">🎯 Prospects</h3>
        <p className="mb-3 text-xs text-slate-600">Contacts flagged as genuine prospects{isTeamView ? " across your team" : ""}.</p>
        {prospectContacts.length === 0 ? (
          <p className="text-xs text-slate-600">No prospects flagged yet.</p>
        ) : (
          <div className="space-y-2">
            {prospectContacts.map((c) => (
              <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5 text-sm">
                <div>
                  <span className="font-medium text-slate-800">{c.name}</span> <span className="text-slate-600">· {c.mobile_no}</span>
                  {c.project_name && <span className="text-slate-600"> · {c.project_name}</span>}
                </div>
                <span className="text-xs text-slate-600">{c.assigned_to ? adminById.get(c.assigned_to)?.display_name ?? "—" : "Unassigned"}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {outgoing.length > 0 && (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-slate-900">My Handoff Requests</h3>
          <div className="space-y-2">
            {outgoing.map((h) => (
              <HandoffRow key={h.id} handoff={h} contact={contactById.get(h.contact_id)} adminById={adminById} showFrom={false} showTo />
            ))}
          </div>
        </section>
      )}

      {isTeamView && teamHandoffs.length > 0 && (
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-slate-900">Team Handoff Activity</h3>
          <div className="space-y-2">
            {teamHandoffs.map((h) => (
              <HandoffRow key={h.id} handoff={h} contact={contactById.get(h.contact_id)} adminById={adminById} showFrom showTo />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
