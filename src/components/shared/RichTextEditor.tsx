// src/components/shared/RichTextEditor.tsx
//
// A real, professional WYSIWYG editor built on TipTap — the same
// underlying engine used by many production apps. Undo/Redo, table
// merge/split, colors, highlights, and bullets are all TipTap's own
// tested commands, not hand-rolled DOM manipulation — this is what
// fixes the fragility from the previous contentEditable-only version.

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { TextStyle, Color, FontFamily, FontSize } from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import ImageExtension from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useRef, useState } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  onImageUpload: (file: File) => Promise<string>;
  minHeight?: number;
  /** Change this when loading genuinely different content (e.g.
   * switching which project you're editing) so the editor knows to
   * reload — everyday typing never touches this. */
  resetKey?: string;
}

const FONT_FAMILIES = ['Arial', 'Georgia', 'Times New Roman', 'Verdana', 'Helvetica', 'Courier New', 'Trebuchet MS'];

const FONT_SIZES = [
  { label: 'Small',   value: '14px' },
  { label: 'Normal',  value: '16px' },
  { label: 'Medium',  value: '18px' },
  { label: 'Large',   value: '22px' },
  { label: 'X-Large', value: '28px' },
  { label: 'Huge',    value: '36px' },
];

const TEXT_COLORS = ['#0F172A', '#DC2626', '#D97706', '#059669', '#2563EB', '#7C3AED', '#DB2777'];
const HIGHLIGHT_COLORS = ['#FEF08A', '#BBF7D0', '#BFDBFE', '#FBCFE8', '#FED7AA'];
const CELL_COLORS = ['#FEF3C7', '#DCFCE7', '#DBEAFE', '#FCE7F3', '#FFEDD5', '#FFFFFF'];

// The default TableCell extension has no concept of a background
// color — this extends it with one real attribute that reads/writes
// straight to the cell's own inline style, so it persists correctly
// in the saved HTML (and survives reload).
const TableCellWithColor = TableCell.extend({
  addAttributes() {
    const parentAttrs = (this as { parent?: () => Record<string, unknown> }).parent?.() ?? {};
    return {
      ...parentAttrs,
      backgroundColor: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.backgroundColor || null,
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.backgroundColor) return {};
          return { style: `background-color: ${attributes.backgroundColor}` };
        },
      },
    };
  },
});

function IconBold({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3.75h6a3.375 3.375 0 0 1 0 6.75h-6v-6.75Zm0 6.75h6.75a3.375 3.375 0 0 1 0 6.75h-6.75V10.5Z" /></svg>);
}
function IconItalic({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.038-.502.08-.752.125M9.75 3.104a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19 14.5M14.25 3.104c.251.037.501.08.752.125M14.25 3.104M5 14.5v3.75A2.25 2.25 0 0 0 7.25 20.5h9.5A2.25 2.25 0 0 0 19 18.25V14.5M5 14.5h14" /></svg>);
}
function IconUnderline({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 3.75v6.75a6 6 0 0 0 12 0V3.75M4.5 20.25h15" /></svg>);
}
function IconStrike({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-13.5-6h9a3 3 0 0 1 0 6M6.75 18h9a3 3 0 0 0 2.5-4.667" /></svg>);
}
function IconBulletList({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>);
}
function IconNumberList({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.242 5.992h12m-12 6.003H20.24m-12 5.999h12M4.117 7.495v-3.75H2.99m1.126 3.75H2.99m1.126 0h1.125M3.74 11.992H2.99v1.126h.75a1.125 1.125 0 0 1 0 2.25H2.99M4.117 19.245v-3.75H2.99v.94" /></svg>);
}
function IconImage({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3 20.25h18a1.5 1.5 0 0 0 1.5-1.5V5.25a1.5 1.5 0 0 0-1.5-1.5H3a1.5 1.5 0 0 0-1.5 1.5v13.5a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25a1.125 1.125 0 1 1-2.25 0 1.125 1.125 0 0 1 2.25 0Z" /></svg>);
}
function IconTable({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5h16.5A.75.75 0 0 1 21 5.25v13.5a.75.75 0 0 1-.75.75H3.75a.75.75 0 0 1-.75-.75V5.25a.75.75 0 0 1 .75-.75Zm0 5.25h16.5m-16.5 5.25h16.5M9 4.5v15m6-15v15" /></svg>);
}
function IconUndo({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg>);
}
function IconRedo({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m15 15 6-6m0 0-6-6m6 6H9a6 6 0 0 0 0 12h3" /></svg>);
}
function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}

function ToolbarButton({ onClick, title, active, disabled, children }: {
  onClick: () => void; title: string; active?: boolean; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg p-2 transition disabled:cursor-not-allowed disabled:opacity-30 ${
        active ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

function RichTextEditor({ value, onChange, onImageUpload, minHeight = 300, resetKey }: RichTextEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showTextColors, setShowTextColors] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);
  const [showTableMenu, setShowTableMenu] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Start writing…' }),
      ImageExtension.configure({ inline: false }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCellWithColor,
    ],
    content: value || '',
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    // Without this, TipTap v3 only re-renders the toolbar on content
    // changes, not on pure selection moves (clicking into a different
    // cell, moving the cursor) — so button active/disabled states and
    // the font dropdowns would show stale, one-step-behind values.
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class: 'rte-content focus:outline-none',
      },
    },
  });

  // Load different content only when resetKey changes (switching
  // which project is being edited) — never on every keystroke, which
  // is what breaks cursor position / undo history.
  useEffect(() => {
    if (editor && resetKey !== undefined) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, editor]);

  async function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    setUploadingImage(true);
    try {
      const url = await onImageUpload(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch {
      // Upload failed — nothing inserted.
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  }

  if (!editor) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <style>{`
        .rte-content { padding: 1rem; font-size: 0.875rem; color: #334155; min-height: ${minHeight}px; }
        .rte-content ul { list-style: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
        .rte-content ol { list-style: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
        .rte-content li { margin: 0.15rem 0; }
        .rte-content table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; }
        .rte-content td, .rte-content th { border: 2px solid #64748B; padding: 8px; vertical-align: top; position: relative; }
        .rte-content th { background: #F1F5F9; font-weight: 600; }
        .rte-content .selectedCell { background: #E0E7FF; }
        .rte-content img { max-width: 100%; border-radius: 8px; margin: 0.5rem 0; }
        .rte-content p.is-editor-empty:first-child::before { color: #94A3B8; content: attr(data-placeholder); float: left; pointer-events: none; height: 0; }
      `}</style>

      <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 p-2">

        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)"><IconUndo /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Y)"><IconRedo /></ToolbarButton>

        <div className="mx-1 h-5 w-px bg-slate-200" />

        <select
          onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
          value={editor.getAttributes('textStyle').fontFamily ?? ''}
          className="cursor-pointer rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
          title="Font family"
        >
          <option value="" disabled>Font</option>
          {FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>

        <select
          onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
          value={editor.getAttributes('textStyle').fontSize ?? ''}
          className="cursor-pointer rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
          title="Font size"
        >
          <option value="" disabled>Size</option>
          {FONT_SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <div className="mx-1 h-5 w-px bg-slate-200" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)"><IconBold /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)"><IconItalic /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (Ctrl+U)"><IconUnderline /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough"><IconStrike /></ToolbarButton>

        <div className="mx-1 h-5 w-px bg-slate-200" />

        <div className="relative">
          <ToolbarButton onClick={() => { setShowTextColors((v) => !v); setShowHighlights(false); }} title="Text color">
            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-red-600">A</span>
          </ToolbarButton>
          {showTextColors && (
            <div className="absolute left-0 top-full z-20 mt-1 flex gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
              {TEXT_COLORS.map((c) => (
                <button key={c} onClick={() => { editor.chain().focus().setColor(c).run(); setShowTextColors(false); }}
                  style={{ backgroundColor: c }} className="h-6 w-6 rounded-full border border-slate-200" />
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <ToolbarButton onClick={() => { setShowHighlights((v) => !v); setShowTextColors(false); }} active={editor.isActive('highlight')} title="Highlight">
            <span className="flex h-4 w-4 items-center justify-center rounded bg-yellow-200 text-[10px] font-bold">H</span>
          </ToolbarButton>
          {showHighlights && (
            <div className="absolute left-0 top-full z-20 mt-1 flex gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
              {HIGHLIGHT_COLORS.map((c) => (
                <button key={c} onClick={() => { editor.chain().focus().toggleHighlight({ color: c }).run(); setShowHighlights(false); }}
                  style={{ backgroundColor: c }} className="h-6 w-6 rounded-full border border-slate-300" />
              ))}
              <button onClick={() => { editor.chain().focus().unsetHighlight().run(); setShowHighlights(false); }}
                title="Remove highlight" className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-xs">✕</button>
            </div>
          )}
        </div>

        <div className="mx-1 h-5 w-px bg-slate-200" />

        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list"><IconBulletList /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list"><IconNumberList /></ToolbarButton>

        <div className="mx-1 h-5 w-px bg-slate-200" />

        <div className="relative">
          <ToolbarButton onClick={() => setShowTableMenu((v) => !v)} title="Table options"><IconTable /></ToolbarButton>
          {showTableMenu && (
            <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl">
              <button onClick={() => { editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); setShowTableMenu(false); }}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">Insert Table</button>
              <div className="my-1 border-t border-slate-100" />
              <button onClick={() => editor.chain().focus().addRowAfter().run()} disabled={!editor.can().addRowAfter()}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-30">Add Row Below</button>
              <button onClick={() => editor.chain().focus().addColumnAfter().run()} disabled={!editor.can().addColumnAfter()}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-30">Add Column Right</button>
              <button onClick={() => editor.chain().focus().deleteRow().run()} disabled={!editor.can().deleteRow()}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-30">Delete Row</button>
              <button onClick={() => editor.chain().focus().deleteColumn().run()} disabled={!editor.can().deleteColumn()}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-30">Delete Column</button>
              <div className="my-1 border-t border-slate-100" />
              <button onClick={() => editor.chain().focus().mergeCells().run()} disabled={!editor.can().mergeCells()}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-30">Merge Selected Cells</button>
              <button onClick={() => editor.chain().focus().splitCell().run()} disabled={!editor.can().splitCell()}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-30">Split Cell</button>
              <div className="my-1 border-t border-slate-100" />
              <div className="px-3 py-1 text-xs font-semibold text-slate-400">Cell Color</div>
              <div className="flex flex-wrap gap-1.5 px-3 py-2">
                {CELL_COLORS.map((c) => (
                  <button key={c} onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', c).run()}
                    style={{ backgroundColor: c }} className="h-6 w-6 rounded border border-slate-300" />
                ))}
              </div>
              <div className="my-1 border-t border-slate-100" />
              <button onClick={() => { editor.chain().focus().deleteTable().run(); setShowTableMenu(false); }} disabled={!editor.can().deleteTable()}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 disabled:opacity-30">Delete Whole Table</button>
            </div>
          )}
        </div>

        <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
        <ToolbarButton onClick={() => imageInputRef.current?.click()} title="Insert image">
          {uploadingImage ? <IconSpinner /> : <IconImage />}
        </ToolbarButton>

      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

export default RichTextEditor;