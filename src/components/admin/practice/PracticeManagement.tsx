// Admin → AI Practice. The trainer switches practice on, writes the customer situations (and what each answer is scored
// on), and sees who is practising and how they are doing. Nothing is hardcoded: the starter situations below are only a
// convenience and can be edited or deleted like any other.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { getCurrentUser } from "../../../services/auth/session";
import {
  getPracticeSettings, savePracticeSettings, listScenarios, createScenario, updateScenario, deleteScenario,
  listCompanyAttempts, deleteAttempt, STARTER_CRITERIA, DEFAULT_PRACTICE_SETTINGS,
} from "../../../repositories/practice/practiceRepository";
import type { PracticeScenario, PracticeAttempt, PracticeSettings, PracticeCriterion, ScenarioForm } from "../../../repositories/practice/practiceRepository";

const INPUT = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30";

const STARTERS: { title: string; customer_says: string; context: string }[] = [
  { title: "Price is too high", customer_says: "Aapke project ka rate bahut zyada hai. Doosre builder isse kam mein de rahe hain.", context: "The customer likes the project but is comparing prices with other builders." },
  { title: "I will think about it", customer_says: "Theek hai, main ghar mein baat karke aapko bata dunga.", context: "The customer attended a site visit and seemed interested, but is trying to end the conversation." },
  { title: "Possession and builder trust", customer_says: "Aajkal builders time par possession nahi dete. Aap par bharosa kaise karun?", context: "A first-time buyer worried about delays and delivery." },
  { title: "Wants a discount today", customer_says: "Agar aap aaj hi discount de do toh main booking kar leta hoon, warna kahin aur dekh lunga.", context: "Customer is pushing for an immediate discount. Policy: no discount beyond the approved scheme." },
];

interface Employee { id: string; first_name: string; last_name: string }

function CriteriaEditor({ value, onChange }: { value: PracticeCriterion[]; onChange: (v: PracticeCriterion[]) => void }) {
  return (
    <div className="space-y-2">
      {value.map((c, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex gap-2">
            <input value={c.name} onChange={(e) => onChange(value.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} placeholder="Scoring point, e.g. Builds value before price" className={INPUT} />
            <button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))} className="shrink-0 rounded-lg px-2.5 text-sm font-semibold text-red-600 hover:bg-red-50" aria-label="Remove">✕</button>
          </div>
          <input value={c.hint ?? ""} onChange={(e) => onChange(value.map((x, k) => (k === i ? { ...x, hint: e.target.value } : x)))} placeholder="What a good answer does here (optional — helps the AI score fairly)" className={`${INPUT} mt-2`} />
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onChange([...value, { name: "", hint: "" }])} disabled={value.length >= 8} className="rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-white disabled:opacity-40">+ Add scoring point</button>
        {value.length === 0 && <button type="button" onClick={() => onChange(STARTER_CRITERIA.map((c) => ({ ...c })))} className="rounded-xl bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">Use the standard 5 points</button>}
      </div>
    </div>
  );
}

const blankForm = (): ScenarioForm => ({ title: "", customer_says: "", context: "", criteria: STARTER_CRITERIA.map((c) => ({ ...c })), active: true });

export default function PracticeManagement() {
  const user = getCurrentUser();
  const [settings, setSettings] = useState<PracticeSettings>(DEFAULT_PRACTICE_SETTINGS);
  const [scenarios, setScenarios] = useState<PracticeScenario[]>([]);
  const [attempts, setAttempts] = useState<PracticeAttempt[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<ScenarioForm>(blankForm());
  const [saving, setSaving] = useState(false);
  const [openAttempt, setOpenAttempt] = useState<string | null>(null);

  function flash(text: string) { setMessage(text); setTimeout(() => setMessage(""), 3000); }

  async function loadAll() {
    if (!user?.companyId) return;
    try {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const [s, sc, at, emps] = await Promise.all([
        getPracticeSettings(user.companyId),
        listScenarios(user.companyId),
        listCompanyAttempts(user.companyId, since),
        supabase.from("employees").select("id, first_name, last_name").eq("company_id", user.companyId),
      ]);
      setSettings(s); setScenarios(sc); setAttempts(at); setEmployees((emps.data ?? []) as Employee[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load AI Practice.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void loadAll(); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const nameOf = useMemo(() => {
    const m = new Map(employees.map((e) => [e.id, `${e.first_name} ${e.last_name}`.trim()]));
    return (id: string) => m.get(id) ?? "Unknown";
  }, [employees]);
  const scenarioTitle = useMemo(() => { const m = new Map(scenarios.map((s) => [s.id, s.title])); return (id: string) => m.get(id) ?? "(deleted situation)"; }, [scenarios]);

  const perPerson = useMemo(() => {
    const m = new Map<string, { n: number; sum: number; best: number; last: string }>();
    for (const a of attempts) {
      const cur = m.get(a.employee_id) ?? { n: 0, sum: 0, best: 0, last: a.created_at };
      cur.n += 1; cur.sum += a.total_score; cur.best = Math.max(cur.best, a.total_score); if (a.created_at > cur.last) cur.last = a.created_at;
      m.set(a.employee_id, cur);
    }
    return [...m.entries()].map(([id, v]) => ({ id, name: nameOf(id), ...v, avg: Math.round(v.sum / v.n) })).sort((a, b) => b.avg - a.avg);
  }, [attempts, nameOf]);

  const perScenario = useMemo(() => {
    const m = new Map<string, { n: number; sum: number }>();
    for (const a of attempts) { const c = m.get(a.scenario_id) ?? { n: 0, sum: 0 }; c.n += 1; c.sum += a.total_score; m.set(a.scenario_id, c); }
    return m;
  }, [attempts]);

  async function handleSaveSettings() {
    if (!user?.companyId) return;
    try { await savePracticeSettings(user.companyId, settings); flash("Settings saved."); } catch (e) { setError(e instanceof Error ? e.message : "Could not save settings."); }
  }

  function startNew(preset?: { title: string; customer_says: string; context: string }) {
    setForm({ ...blankForm(), ...(preset ?? {}) });
    setEditingId("new");
    setError("");
  }
  function startEdit(s: PracticeScenario) {
    setForm({ title: s.title, customer_says: s.customer_says, context: s.context, criteria: s.criteria.map((c) => ({ ...c })), active: s.active });
    setEditingId(s.id);
    setError("");
  }

  async function handleSaveScenario() {
    if (!user?.companyId) return;
    const criteria = form.criteria.map((c) => ({ name: c.name.trim(), hint: (c.hint ?? "").trim() })).filter((c) => c.name);
    if (!form.title.trim()) { setError("Give the situation a short title."); return; }
    if (!form.customer_says.trim()) { setError("Write what the customer says."); return; }
    if (criteria.length === 0) { setError("Add at least one scoring point."); return; }
    setSaving(true); setError("");
    try {
      const payload: ScenarioForm = { ...form, title: form.title.trim(), customer_says: form.customer_says.trim(), context: form.context.trim(), criteria };
      if (editingId === "new") await createScenario(user.companyId, user.id ?? null, payload, scenarios.length);
      else if (editingId) await updateScenario(editingId, payload);
      setEditingId(null);
      await loadAll();
      flash("Situation saved.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save."); } finally { setSaving(false); }
  }

  async function handleDeleteScenario(s: PracticeScenario) {
    if (!confirm(`Delete “${s.title}”? Everyone's practice results for it are deleted too.`)) return;
    try { await deleteScenario(s.id); await loadAll(); } catch (e) { setError(e instanceof Error ? e.message : "Could not delete."); }
  }

  async function handleDeleteAttempt(id: string) {
    if (!confirm("Delete this practice attempt?")) return;
    try { await deleteAttempt(id); setAttempts((p) => p.filter((a) => a.id !== id)); } catch (e) { setError(e instanceof Error ? e.message : "Could not delete."); }
  }

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">AI Practice</h2>
        <p className="text-sm text-slate-500">Employees practise real customer situations by typing or speaking; the AI scores them on the points you set and shows a better way to say it.</p>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">✅ {message}</div>}

      <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Switch</h3>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} className="h-4 w-4" />
          AI Practice is ON for my employees
        </label>
        <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
          Tries per person per day
          <input type="number" min={1} max={100} value={settings.daily_limit} onChange={(e) => setSettings({ ...settings, daily_limit: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })} className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm" />
          <span className="text-xs text-slate-400">The AI is free but has a daily allowance for the whole platform, so keep this reasonable.</span>
        </label>
        <p className="text-xs text-slate-400">What employees type or say is sent to Google's free AI to be scored, and is visible to you here.</p>
        <button onClick={handleSaveSettings} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Save</button>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Situations ({scenarios.length})</h3>
          {editingId === null && <button onClick={() => startNew()} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">+ New situation</button>}
        </div>

        {editingId !== null && (
          <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
            <div><label className="mb-1 block text-xs font-semibold text-slate-600">Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Price is too high" className={INPUT} /></div>
            <div><label className="mb-1 block text-xs font-semibold text-slate-600">What the customer says</label><textarea value={form.customer_says} onChange={(e) => setForm({ ...form, customer_says: e.target.value })} rows={3} placeholder="Write it exactly as a customer would say it — Hinglish is fine" className={INPUT} /></div>
            <div><label className="mb-1 block text-xs font-semibold text-slate-600">Background for the AI and the employee (optional)</label><textarea value={form.context} onChange={(e) => setForm({ ...form, context: e.target.value })} rows={2} placeholder="e.g. Customer visited the site yesterday. Policy: no discount beyond the approved scheme." className={INPUT} /></div>
            <div><label className="mb-1 block text-xs font-semibold text-slate-600">What the answer is scored on (up to 8)</label><CriteriaEditor value={form.criteria} onChange={(criteria) => setForm({ ...form, criteria })} /></div>
            <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Visible to employees</label>
            <div className="flex gap-2">
              <button onClick={handleSaveScenario} disabled={saving} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{saving ? "Saving…" : "Save situation"}</button>
              <button onClick={() => setEditingId(null)} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-white">Cancel</button>
            </div>
          </div>
        )}

        {scenarios.length === 0 && editingId === null && (
          <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50 p-4">
            <p className="text-sm text-indigo-900">No situations yet. Start with these four common ones (you can edit or delete them), or write your own.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {STARTERS.map((st) => <button key={st.title} onClick={() => startNew(st)} className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-indigo-700 shadow-sm hover:bg-indigo-100">+ {st.title}</button>)}
            </div>
          </div>
        )}

        <div className="space-y-2">
          {scenarios.map((s) => {
            const st = perScenario.get(s.id);
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{s.title} {!s.active && <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600">Hidden</span>}</p>
                  <p className="line-clamp-1 text-xs italic text-slate-500">“{s.customer_says}”</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{s.criteria.length} scoring points{st ? ` · ${st.n} tries, average ${Math.round(st.sum / st.n)}` : " · no tries yet"}</p>
                </div>
                <div className="flex gap-1.5 text-xs font-semibold">
                  <button onClick={() => void updateScenario(s.id, { active: !s.active }).then(loadAll)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600 hover:bg-slate-50">{s.active ? "Hide" : "Show"}</button>
                  <button onClick={() => startEdit(s)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-600 hover:bg-slate-50">Edit</button>
                  <button onClick={() => void handleDeleteScenario(s)} className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-red-600 hover:bg-red-50">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Who is practising</h3>
          <div className="flex rounded-lg bg-slate-100 p-0.5">
            {[7, 30, 90].map((d) => <button key={d} onClick={() => setDays(d)} className={`rounded-md px-3 py-1.5 text-xs font-medium ${days === d ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>{d} days</button>)}
          </div>
        </div>

        {attempts.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Nobody has practised in the last {days} days.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-2">Employee</th><th className="px-3 py-2 text-right">Tries</th><th className="px-3 py-2 text-right">Average</th><th className="px-3 py-2 text-right">Best</th><th className="px-3 py-2 text-right">Last</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {perPerson.map((p) => (
                    <tr key={p.id}><td className="px-4 py-2 font-medium text-slate-800">{p.name}</td><td className="px-3 py-2 text-right font-mono">{p.n}</td><td className="px-3 py-2 text-right font-mono font-bold">{p.avg}</td><td className="px-3 py-2 text-right font-mono">{p.best}</td><td className="px-3 py-2 text-right text-slate-500">{new Date(p.last).toLocaleDateString()}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-900">Recent tries</p>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {attempts.slice(0, 40).map((a) => (
                  <div key={a.id} className="px-4 py-2.5">
                    <button onClick={() => setOpenAttempt(openAttempt === a.id ? null : a.id)} className="flex w-full items-center gap-3 text-left">
                      <span className="w-9 shrink-0 text-center text-sm font-bold" style={{ color: a.total_score >= 75 ? "#059669" : a.total_score >= 50 ? "#D97706" : "#DC2626" }}>{a.total_score}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-800">{nameOf(a.employee_id)} — {scenarioTitle(a.scenario_id)}</span><span className="block text-[11px] text-slate-400">{new Date(a.created_at).toLocaleString()}{a.spoken ? " · 🎤 spoken" : ""}</span></span>
                      <span className="text-slate-400">{openAttempt === a.id ? "▲" : "▼"}</span>
                    </button>
                    {openAttempt === a.id && (
                      <div className="mt-2 space-y-2 rounded-lg bg-slate-50 p-3 text-xs">
                        <p className="whitespace-pre-line text-slate-700"><b>Answer:</b> {a.answer_text}</p>
                        <ul className="space-y-0.5 text-slate-600">{a.scores.map((s) => <li key={s.name}><b>{s.score}/10</b> {s.name}{s.comment ? ` — ${s.comment}` : ""}</li>)}</ul>
                        <p className="text-slate-600"><b>AI feedback:</b> {a.feedback}</p>
                        <button onClick={() => void handleDeleteAttempt(a.id)} className="font-semibold text-red-600 hover:underline">Delete this try</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
