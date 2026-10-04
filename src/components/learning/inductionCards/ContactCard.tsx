// "Your buddy / mentor" card: who to ask, with one-tap call and WhatsApp buttons. The picture is the card picture.

import { whatsappLink } from '../../../utils/inductionCards';
import type { InductionDaySection } from '../../../types/induction';

export default function ContactCard({ section }: { section: InductionDaySection }) {
  const cfg = section.config ?? {};
  const wa = whatsappLink(cfg.whatsapp || cfg.phone);
  const tel = (cfg.phone ?? '').replace(/[^\d+]/g, '');

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-100 bg-slate-50 p-6 text-center">
      {section.thumbnail_url
        ? <img src={section.thumbnail_url} alt="" className="mx-auto h-28 w-28 rounded-full object-cover shadow" />
        : <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-indigo-100 text-4xl">🙋</div>}
      {cfg.name ? <p className="mt-4 text-xl font-bold text-slate-900">{cfg.name}</p> : <p className="mt-4 text-sm text-slate-400">No name added yet.</p>}
      {cfg.role && <p className="text-sm font-medium text-indigo-600">{cfg.role}</p>}
      {cfg.note && <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">{cfg.note}</p>}
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {tel && <a href={`tel:${tel}`} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">📞 Call</a>}
        {wa && <a href={wa} target="_blank" rel="noreferrer" className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">💬 WhatsApp</a>}
      </div>
    </div>
  );
}
