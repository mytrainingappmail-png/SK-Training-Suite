// Coupon codes: percent or fixed amount, a minimum order, a cap, which formats it covers, a validity period and how often it can be used.

import { useEffect, useState } from 'react';
import { deleteAdminCoupon, loadAdminCoupons, saveAdminCoupon, setCouponActive } from '../../services/shop/shopAdminService';
import type { AdminCoupon, CouponDraft } from '../../services/shop/shopAdminService';
import { A_BTN, A_BTN_DANGER, A_BTN_GOLD, A_BTN_LIGHT, A_INPUT, Card, Field, Notice, Toggle, money } from './shopAdminUi';

const BLANK: CouponDraft = {
  code: '', description: '', kind: 'percent', value: 10, min_order: 0, max_discount: null, applies_to: 'all',
  valid_from: null, valid_until: null, usage_limit: null, per_phone_limit: 1, active: true,
};

// <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm"
function toLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function describe(c: AdminCoupon, symbol: string): string {
  const what = c.kind === 'percent' ? `${c.value}% off${c.max_discount ? ` (up to ${money(c.max_discount, symbol)})` : ''}` : `${money(c.value, symbol)} off`;
  const on = c.applies_to === 'all' ? 'everything' : c.applies_to === 'physical' ? 'books only' : 'e-books only';
  return `${what} on ${on}${c.min_order > 0 ? ` · orders from ${money(c.min_order, symbol)}` : ''}`;
}

export default function ShopCouponsPanel({ symbol }: { symbol: string }) {
  const [coupons, setCoupons] = useState<AdminCoupon[] | null>(null);
  const [edit, setEdit] = useState<CouponDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  function load() { loadAdminCoupons().then(setCoupons).catch((e: unknown) => setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Could not load.' })); }
  useEffect(load, []);

  function set<K extends keyof CouponDraft>(k: K, v: CouponDraft[K]) { setEdit((x) => (x ? { ...x, [k]: v } : x)); setMsg(null); }
  const num = (v: string): number | null => (v === '' ? null : Number(v));

  async function save() {
    if (!edit) return;
    setSaving(true); setMsg(null);
    try { await saveAdminCoupon(edit); setEdit(null); setMsg({ kind: 'ok', text: 'Coupon saved.' }); load(); }
    catch (e) { setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Could not save.' }); }
    finally { setSaving(false); }
  }

  if (edit) {
    return (
      <div className="space-y-5">
        <button onClick={() => setEdit(null)} className="text-sm font-semibold text-indigo-600 hover:underline">← Back to coupons</button>
        <Card title={edit.id ? 'Edit coupon' : 'New coupon'}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Coupon code *" hint="Customers type this. Capital letters, no spaces."><input className={`${A_INPUT} uppercase`} value={edit.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="e.g. WELCOME10" /></Field>
            <Field label="Note for yourself"><input className={A_INPUT} value={edit.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field>
            <Field label="Type">
              <select className={A_INPUT} value={edit.kind} onChange={(e) => set('kind', e.target.value as 'percent' | 'flat')}>
                <option value="percent">Percentage off</option>
                <option value="flat">Fixed amount off</option>
              </select>
            </Field>
            <Field label={edit.kind === 'percent' ? 'Percentage' : `Amount (${symbol})`}><input className={A_INPUT} type="number" min={0} value={edit.value} onChange={(e) => set('value', Number(e.target.value))} /></Field>
            {edit.kind === 'percent' && <Field label={`Maximum discount (${symbol})`} hint="Optional cap, e.g. 10% but not more than 200."><input className={A_INPUT} type="number" min={0} value={edit.max_discount ?? ''} onChange={(e) => set('max_discount', num(e.target.value))} /></Field>}
            <Field label={`Minimum order (${symbol})`}><input className={A_INPUT} type="number" min={0} value={edit.min_order} onChange={(e) => set('min_order', Number(e.target.value))} /></Field>
            <Field label="Works on">
              <select className={A_INPUT} value={edit.applies_to} onChange={(e) => set('applies_to', e.target.value as CouponDraft['applies_to'])}>
                <option value="all">Everything</option>
                <option value="physical">Physical books only</option>
                <option value="ebook">E-books only</option>
              </select>
            </Field>
            <Field label="Starts" hint="Blank = already running"><input className={A_INPUT} type="datetime-local" value={toLocal(edit.valid_from)} onChange={(e) => set('valid_from', e.target.value || null)} /></Field>
            <Field label="Ends" hint="Blank = never ends"><input className={A_INPUT} type="datetime-local" value={toLocal(edit.valid_until)} onChange={(e) => set('valid_until', e.target.value || null)} /></Field>
            <Field label="Total times it can be used" hint="Blank = no limit"><input className={A_INPUT} type="number" min={1} value={edit.usage_limit ?? ''} onChange={(e) => set('usage_limit', num(e.target.value))} /></Field>
            <Field label="Times one mobile number can use it" hint="Blank = no limit"><input className={A_INPUT} type="number" min={1} value={edit.per_phone_limit ?? ''} onChange={(e) => set('per_phone_limit', num(e.target.value))} /></Field>
          </div>
          <div className="mt-4"><Toggle checked={edit.active} onChange={(v) => set('active', v)} label="Active" /></div>
        </Card>
        {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
        <div className="flex gap-3">
          <button onClick={() => void save()} disabled={saving} className={A_BTN}>{saving ? 'Saving…' : '💾 Save coupon'}</button>
          <button onClick={() => setEdit(null)} className={A_BTN_LIGHT}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Give customers a discount code.</p>
        <button onClick={() => setEdit({ ...BLANK })} className={A_BTN_GOLD}>＋ New coupon</button>
      </div>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      {coupons && coupons.length === 0 && <div className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">No coupons yet.</div>}
      <div className="space-y-3">
        {(coupons ?? []).map((c) => {
          const expired = c.valid_until && new Date(c.valid_until) < new Date();
          const used = c.usage_limit != null && c.used_count >= c.usage_limit;
          return (
            <article key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg bg-indigo-50 px-3 py-1 font-mono text-sm font-extrabold tracking-wider text-indigo-700">{c.code}</span>
                  {expired && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">Expired</span>}
                  {used && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">Fully used</span>}
                </div>
                <p className="mt-1 text-sm text-slate-700">{describe(c, symbol)}</p>
                <p className="text-xs text-slate-400">
                  Used {c.used_count}{c.usage_limit ? ` of ${c.usage_limit}` : ''} times
                  {c.valid_until ? ` · ends ${new Date(c.valid_until).toLocaleDateString('en-IN', { dateStyle: 'medium' })}` : ''}
                  {c.description ? ` · ${c.description}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Toggle checked={c.active} onChange={(v) => void setCouponActive(c.id, v).then(load).catch((e: unknown) => setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Could not change.' }))} label={c.active ? 'Active' : 'Off'} />
                <button onClick={() => setEdit({ ...c })} className={A_BTN_LIGHT}>Edit</button>
                <button onClick={() => { if (window.confirm(`Delete coupon ${c.code}?`)) void deleteAdminCoupon(c.id).then(load).catch((e: unknown) => setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Could not delete.' })); }} className={A_BTN_DANGER}>Delete</button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
