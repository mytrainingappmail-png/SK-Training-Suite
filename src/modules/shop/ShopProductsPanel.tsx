// The owner's books: add a book with as many pictures as wanted, choose the formats (physical book / e-book), prices, stock and the e-book file.

import { useEffect, useRef, useState } from 'react';
import {
  deleteAdminProduct, loadAdminProducts, removeEbookFile, saveAdminProduct, setProductActive, uploadEbookFile, uploadShopImage,
} from '../../services/shop/shopAdminService';
import type { AdminProduct, ProductDraft } from '../../services/shop/shopAdminService';
import { A_BTN, A_BTN_DANGER, A_BTN_GOLD, A_BTN_LIGHT, A_INPUT, Card, Field, Notice, Toggle, money } from './shopAdminUi';

const BLANK: ProductDraft = {
  title: '', subtitle: '', description: '', images: [],
  physical_enabled: true, physical_price: null, physical_mrp: null, physical_stock: null,
  ebook_enabled: false, ebook_price: null, ebook_mrp: null, ebook_file_path: null, ebook_file_name: null,
  featured: false, active: true, display_order: 0,
};

function Editor({ initial, symbol, onClose, onSaved }: { initial: ProductDraft; symbol: string; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<ProductDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [upBusy, setUpBusy] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const originalFile = useRef(initial.ebook_file_path);
  const newFiles = useRef<string[]>([]);   // e-book files uploaded in this session (removed again if the form is abandoned)

  function set<K extends keyof ProductDraft>(k: K, v: ProductDraft[K]) { setD((x) => ({ ...x, [k]: v })); setMsg(null); }
  const num = (v: string): number | null => (v === '' ? null : Number(v));

  async function addImages(files: FileList | File[] | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setMsg(null);
    const urls: string[] = [];
    for (let i = 0; i < list.length; i++) {
      setUpBusy(`Uploading picture ${i + 1} of ${list.length}…`);
      try { urls.push(await uploadShopImage(list[i])); }
      catch (e) { setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Upload failed.' }); }
    }
    setUpBusy('');
    if (urls.length) setD((x) => ({ ...x, images: [...x.images, ...urls] }));
    if (imgRef.current) imgRef.current.value = '';
  }

  function moveImage(i: number, dir: -1 | 1) {
    setD((x) => {
      const j = i + dir;
      if (j < 0 || j >= x.images.length) return x;
      const imgs = x.images.slice();
      [imgs[i], imgs[j]] = [imgs[j], imgs[i]];
      return { ...x, images: imgs };
    });
  }
  function makeCover(i: number) { setD((x) => ({ ...x, images: [x.images[i], ...x.images.filter((_, k) => k !== i)] })); }
  function removeImage(i: number) { setD((x) => ({ ...x, images: x.images.filter((_, k) => k !== i) })); }

  async function pickEbook(file: File | undefined) {
    if (!file) return;
    setMsg(null); setUpBusy('Uploading the e-book file… (large files take a little while)');
    try {
      const up = await uploadEbookFile(file);
      newFiles.current.push(up.path);
      setD((x) => ({ ...x, ebook_file_path: up.path, ebook_file_name: up.name }));
    } catch (e) { setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Upload failed.' }); }
    finally { setUpBusy(''); if (fileRef.current) fileRef.current.value = ''; }
  }

  async function save() {
    setSaving(true); setMsg(null);
    try {
      await saveAdminProduct(d);
      // a replaced e-book file is no longer needed
      if (originalFile.current && originalFile.current !== d.ebook_file_path) await removeEbookFile(originalFile.current).catch(() => undefined);
      newFiles.current = newFiles.current.filter((p) => p !== d.ebook_file_path);
      newFiles.current.forEach((p) => void removeEbookFile(p).catch(() => undefined));
      onSaved();
    } catch (e) { setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Could not save.' }); }
    finally { setSaving(false); }
  }

  function cancel() {
    newFiles.current.forEach((p) => void removeEbookFile(p).catch(() => undefined));
    onClose();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={cancel} className="text-sm font-semibold text-indigo-600 hover:underline">← Back to books</button>
        <h2 className="text-lg font-extrabold text-slate-900">{d.id ? 'Edit book' : 'Add a book'}</h2>
      </div>

      <Card title="About the book">
        <div className="grid gap-4">
          <Field label="Book title *"><input className={A_INPUT} value={d.title} onChange={(e) => set('title', e.target.value)} /></Field>
          <Field label="Short line under the title" hint="e.g. author name or a one-line promise"><input className={A_INPUT} value={d.subtitle ?? ''} onChange={(e) => set('subtitle', e.target.value)} /></Field>
          <Field label="Description" hint="Tell readers what is inside. Blank lines make new paragraphs."><textarea className={A_INPUT} rows={7} value={d.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field>
        </div>
      </Card>

      <Card title="🖼 Pictures" subtitle="Add as many pictures as you like (front cover, back cover, inside pages). The first picture is the cover shown in the shop.">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void addImages(e.dataTransfer.files); }}
          className="rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4"
        >
          <input ref={imgRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple className="hidden" onChange={(e) => void addImages(e.target.files)} />
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => imgRef.current?.click()} disabled={!!upBusy} className={A_BTN_GOLD}>⬆ Choose pictures</button>
            <span className="text-xs text-slate-500">or drag pictures here · up to 8 MB each</span>
            {upBusy && <span className="text-xs font-semibold text-indigo-600">{upBusy}</span>}
          </div>
          {d.images.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {d.images.map((src, i) => (
                <div key={src} className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
                  <div className="relative aspect-[3/4] bg-slate-100">
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    {i === 0 && <span className="absolute left-1 top-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-extrabold text-slate-900">Cover</span>}
                  </div>
                  <div className="flex items-center justify-between gap-0.5 p-1 text-xs">
                    <button onClick={() => moveImage(i, -1)} disabled={i === 0} className="rounded px-1.5 py-1 font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30" title="Move earlier">◀</button>
                    {i > 0 && <button onClick={() => makeCover(i)} className="rounded px-1.5 py-1 font-bold text-amber-700 hover:bg-amber-50" title="Make this the cover">★</button>}
                    <button onClick={() => moveImage(i, 1)} disabled={i === d.images.length - 1} className="rounded px-1.5 py-1 font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30" title="Move later">▶</button>
                    <button onClick={() => removeImage(i)} className="rounded px-1.5 py-1 font-bold text-red-500 hover:bg-red-50" title="Remove">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="📖 Physical book" right={<Toggle checked={d.physical_enabled} onChange={(v) => set('physical_enabled', v)} label={d.physical_enabled ? 'On' : 'Off'} />}>
          <div className={`grid gap-4 sm:grid-cols-2 ${d.physical_enabled ? '' : 'pointer-events-none opacity-40'}`}>
            <Field label={`Selling price (${symbol})`}><input className={A_INPUT} type="number" min={0} value={d.physical_price ?? ''} onChange={(e) => set('physical_price', num(e.target.value))} /></Field>
            <Field label={`MRP (${symbol})`} hint="Optional. Shown struck through."><input className={A_INPUT} type="number" min={0} value={d.physical_mrp ?? ''} onChange={(e) => set('physical_mrp', num(e.target.value))} /></Field>
            <Field label="Copies in stock" hint="Blank = do not count. At 0 it shows Out of stock." className="sm:col-span-2"><input className={A_INPUT} type="number" min={0} value={d.physical_stock ?? ''} onChange={(e) => set('physical_stock', num(e.target.value))} /></Field>
          </div>
        </Card>

        <Card title="📱 E-book" right={<Toggle checked={d.ebook_enabled} onChange={(v) => set('ebook_enabled', v)} label={d.ebook_enabled ? 'On' : 'Off'} />}>
          <div className={`grid gap-4 sm:grid-cols-2 ${d.ebook_enabled ? '' : 'pointer-events-none opacity-40'}`}>
            <Field label={`Selling price (${symbol})`}><input className={A_INPUT} type="number" min={0} value={d.ebook_price ?? ''} onChange={(e) => set('ebook_price', num(e.target.value))} /></Field>
            <Field label={`MRP (${symbol})`} hint="Optional."><input className={A_INPUT} type="number" min={0} value={d.ebook_mrp ?? ''} onChange={(e) => set('ebook_mrp', num(e.target.value))} /></Field>
            <Field label="E-book file" hint="PDF or EPUB, up to 50 MB. Customers get it only after you confirm their payment." className="sm:col-span-2">
              <input ref={fileRef} type="file" accept=".pdf,.epub,.mobi,application/pdf,application/epub+zip" className="hidden" onChange={(e) => void pickEbook(e.target.files?.[0])} />
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={!!upBusy} className={A_BTN_LIGHT}>{d.ebook_file_path ? 'Replace file' : '⬆ Upload file'}</button>
                {d.ebook_file_path ? <span className="truncate text-sm font-semibold text-emerald-700">✓ {d.ebook_file_name || 'File uploaded'}</span> : <span className="text-xs text-amber-700">No file yet</span>}
              </div>
            </Field>
          </div>
        </Card>
      </div>

      <Card title="Showing in the shop">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <Toggle checked={d.active} onChange={(v) => set('active', v)} label="Visible in the shop" />
          <Toggle checked={d.featured} onChange={(v) => set('featured', v)} label="⭐ Featured (shown first)" />
          <Field label="Order number" hint="smaller shows earlier" className="w-32"><input className={A_INPUT} type="number" value={d.display_order} onChange={(e) => set('display_order', Number(e.target.value))} /></Field>
        </div>
      </Card>

      {upBusy && <Notice kind="info">{upBusy}</Notice>}
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <div className="flex flex-wrap gap-3">
        <button onClick={() => void save()} disabled={saving || !!upBusy} className={A_BTN}>{saving ? 'Saving…' : '💾 Save book'}</button>
        <button onClick={cancel} className={A_BTN_LIGHT}>Cancel</button>
      </div>
    </div>
  );
}

export default function ShopProductsPanel({ symbol, shopUrl, onChanged }: { symbol: string; shopUrl: string; onChanged: () => void }) {
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [editing, setEditing] = useState<ProductDraft | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  function load() { loadAdminProducts().then(setProducts).catch((e: unknown) => setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Could not load.' })); }
  useEffect(load, []);

  async function toggle(p: AdminProduct) {
    try { await setProductActive(p.id, !p.active); load(); onChanged(); } catch (e) { setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Could not change.' }); }
  }
  async function remove(p: AdminProduct) {
    if (!window.confirm(`Delete "${p.title}"? Past orders keep their record. This cannot be undone.`)) return;
    try { await deleteAdminProduct(p); setMsg({ kind: 'ok', text: 'Book deleted.' }); load(); onChanged(); } catch (e) { setMsg({ kind: 'error', text: e instanceof Error ? e.message : 'Could not delete.' }); }
  }

  if (editing) {
    return <Editor initial={editing} symbol={symbol} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setMsg({ kind: 'ok', text: 'Book saved.' }); load(); onChanged(); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{products ? `${products.length} book${products.length === 1 ? '' : 's'}` : 'Loading…'}</p>
        <button onClick={() => setEditing({ ...BLANK, display_order: (products?.length ?? 0) })} className={A_BTN_GOLD}>＋ Add a book</button>
      </div>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}

      {products && products.length === 0 && (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
          <div className="text-5xl">📚</div>
          <p className="mt-2 font-bold text-slate-800">No books yet</p>
          <p className="text-sm text-slate-500">Add your first book — it takes a minute.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(products ?? []).map((p) => (
          <article key={p.id} className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <div className="h-32 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
              {p.images[0] ? <img src={p.images[0]} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-3xl">📕</div>}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="line-clamp-2 text-sm font-extrabold text-slate-900">{p.title}</h3>
                {p.featured && <span className="flex-shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-800">⭐</span>}
              </div>
              <div className="mt-1 space-y-0.5 text-xs text-slate-600">
                {p.physical_enabled && <p>📖 {money(p.physical_price, symbol)} · {p.physical_stock == null ? 'stock not counted' : p.physical_stock === 0 ? <b className="text-red-600">out of stock</b> : `${p.physical_stock} in stock`}</p>}
                {p.ebook_enabled && <p>📱 {money(p.ebook_price, symbol)} · {p.ebook_file_path ? 'file ready' : <b className="text-red-600">no file</b>}</p>}
                <p className="text-slate-400">{p.images.length} picture{p.images.length === 1 ? '' : 's'}</p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Toggle checked={p.active} onChange={() => void toggle(p)} label={p.active ? 'Visible' : 'Hidden'} />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button onClick={() => setEditing({ ...p })} className={A_BTN_LIGHT}>Edit</button>
                <a href={`${shopUrl}/p/${p.id}`} target="_blank" rel="noreferrer" className={A_BTN_LIGHT}>View ↗</a>
                <button onClick={() => void remove(p)} className={A_BTN_DANGER}>Delete</button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
