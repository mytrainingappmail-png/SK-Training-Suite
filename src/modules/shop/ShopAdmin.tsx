// Admin -> Shop (platform owner only): switch the shop open / closed, see how to get started, and manage Orders, Books, Coupons and Settings.

import { useCallback, useEffect, useState } from 'react';
import { loadAdminProducts, loadShopSettings, saveShopSettings } from '../../services/shop/shopAdminService';
import type { ShopSettings } from '../../services/shop/shopAdminService';
import ShopOrdersPanel from './ShopOrdersPanel';
import ShopProductsPanel from './ShopProductsPanel';
import ShopCouponsPanel from './ShopCouponsPanel';
import ShopSettingsPanel from './ShopSettingsPanel';
import ShopReportsPanel from './ShopReportsPanel';
import { A_BTN_LIGHT, Notice, Toggle } from './shopAdminUi';

type Tab = 'orders' | 'books' | 'coupons' | 'reports' | 'settings';

export default function ShopAdmin() {
  const [tab, setTab] = useState<Tab>('orders');
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [bookCount, setBookCount] = useState<number | null>(null);
  const [toCheck, setToCheck] = useState(0);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(() => {
    loadShopSettings().then(setSettings).catch((e: unknown) => setError(e instanceof Error ? e.message : 'The shop could not be loaded.'));
    loadAdminProducts().then((p) => setBookCount(p.length)).catch(() => undefined);
  }, []);
  useEffect(refresh, [refresh]);

  const shopUrl = `${window.location.origin}/shop`;

  async function toggleOpen(v: boolean) {
    if (!settings) return;
    if (v && !settings.upi_id) { setError('Add your UPI ID in Settings before opening the shop, so customers can pay.'); setTab('settings'); return; }
    setError('');
    try { await saveShopSettings({ enabled: v }); setSettings({ ...settings, enabled: v }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not change.'); }
  }

  const steps = settings ? [
    { done: !!settings.upi_id, text: 'Add your UPI ID', go: 'settings' as Tab },
    { done: (bookCount ?? 0) > 0, text: 'Add your first book', go: 'books' as Tab },
    { done: settings.enabled, text: 'Open the shop', go: null },
  ] : [];
  const setupDone = steps.length > 0 && steps.every((s) => s.done);

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'orders', label: '🧾 Orders', badge: toCheck },
    { key: 'books', label: '📚 Books' },
    { key: 'coupons', label: '🏷 Coupons' },
    { key: 'reports', label: '📊 Reports' },
    { key: 'settings', label: '⚙️ Settings' },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-gradient-to-r from-[#14264d] to-[#0e1c3d] p-5 text-white shadow-lg sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold">🛍 Shop</h1>
            <p className="mt-0.5 text-sm text-slate-300">Sell your books — physical and e-book — with UPI / QR payment.</p>
          </div>
          {settings && (
            <div className="rounded-2xl bg-white/10 px-4 py-3">
              <Toggle checked={settings.enabled} onChange={(v) => void toggleOpen(v)} label={settings.enabled ? 'Shop is OPEN' : 'Shop is CLOSED'} />
            </div>
          )}
        </div>
        {settings?.enabled && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-lg bg-white/10 px-3 py-1.5 font-mono text-xs">{shopUrl}</span>
            <button onClick={() => { void navigator.clipboard?.writeText(shopUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }); }} className="rounded-lg bg-white/15 px-3 py-1.5 font-semibold hover:bg-white/25">{copied ? 'Copied ✓' : 'Copy link'}</button>
            <a href={shopUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-amber-400 px-3 py-1.5 font-bold text-slate-900 hover:bg-amber-300">Open the shop ↗</a>
          </div>
        )}
      </div>

      {error && <Notice kind="error">{error}</Notice>}

      {settings && !setupDone && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-extrabold text-amber-900">Get started in 3 steps</p>
          <ol className="flex flex-wrap gap-3">
            {steps.map((s, i) => (
              <li key={s.text}>
                <button disabled={!s.go} onClick={() => s.go && setTab(s.go)} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${s.done ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-slate-700 ring-1 ring-amber-300'}`}>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${s.done ? 'bg-emerald-500 text-white' : 'bg-amber-400 text-slate-900'}`}>{s.done ? '✓' : i + 1}</span>
                  {s.text}
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`relative rounded-xl px-4 py-2.5 text-sm font-bold transition ${tab === t.key ? 'bg-indigo-600 text-white shadow' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
            {t.label}
            {!!t.badge && <span className="ml-2 rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-black text-white">{t.badge}</span>}
          </button>
        ))}
        {settings?.enabled === false && <span className="ml-auto self-center"><button onClick={() => void toggleOpen(true)} className={A_BTN_LIGHT}>Open the shop</button></span>}
      </div>

      {settings && tab === 'orders' && <ShopOrdersPanel symbol={settings.currency_symbol} countryCode={settings.phone_country_code} onCount={setToCheck} />}
      {settings && tab === 'books' && <ShopProductsPanel symbol={settings.currency_symbol} shopUrl={shopUrl} onChanged={refresh} />}
      {settings && tab === 'coupons' && <ShopCouponsPanel symbol={settings.currency_symbol} />}
      {settings && tab === 'reports' && <ShopReportsPanel symbol={settings.currency_symbol} />}
      {tab === 'settings' && <ShopSettingsPanel onSaved={refresh} />}
      {!settings && !error && <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />}
    </div>
  );
}
