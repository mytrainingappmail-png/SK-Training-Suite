import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { loadItems, saveItem, editItem, removeItem } from '../../../services/brainstorming/brainstormingService';
import { loadBrainstormingSettings, saveBrainstormingSettings } from '../../../services/brainstormingSettings/brainstormingSettingsService';
import { uploadAudio } from '../../../services/contentEditor/contentEditorService';
import { listVoices, speakSample, startTensionMusic, stopTensionMusic, playCustomSound, startCustomMusic, stopCustomMusic } from '../../../utils/quizVoice';
import type { BrainstormingItem, BrainstormingItemForm, OptionLetter } from '../../../types/brainstorming';
import { defaultBrainstormingItemForm } from '../../../types/brainstorming';
import type { BrainstormingSettings, BrainstormingVoiceStyle } from '../../../types/brainstormingSettings';

const INPUT_CLS = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';
const OPTION_KEYS: { key: 'option_a' | 'option_b' | 'option_c' | 'option_d'; letter: OptionLetter; label: string }[] = [
  { key: 'option_a', letter: 'a', label: 'A' },
  { key: 'option_b', letter: 'b', label: 'B' },
  { key: 'option_c', letter: 'c', label: 'C' },
  { key: 'option_d', letter: 'd', label: 'D' },
];

const VOICE_STYLE_OPTIONS: { value: BrainstormingVoiceStyle; label: string; hint: string }[] = [
  { value: 'classic', label: 'Classic Host', hint: 'Balanced, warm game-show tone' },
  { value: 'energetic', label: 'Energetic Announcer', hint: 'Higher, faster, upbeat' },
  { value: 'dramatic', label: 'Dramatic Narrator', hint: 'Deep, slow, suspenseful' },
];

function AudioUploadRow({
  label, url, uploading, inputRef, onUpload, onRemove, onTest, onStopTest, holdToTest,
}: {
  label: string;
  url: string;
  uploading: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onUpload: (file: File) => void;
  onRemove: () => void;
  onTest: () => void;
  onStopTest?: () => void;
  holdToTest?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 p-3">
      <div className="min-w-[140px] flex-1">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="truncate text-xs text-slate-400">{url ? url.split('/').pop() : 'No file uploaded'}</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onUpload(f); }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {uploading ? 'Uploading…' : url ? 'Replace' : 'Upload'}
      </button>
      {url && (
        <>
          {holdToTest ? (
            <button
              type="button"
              onMouseDown={onTest}
              onMouseUp={onStopTest}
              onMouseLeave={onStopTest}
              className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              ▶ Hold to Play
            </button>
          ) : (
            <button
              type="button"
              onClick={onTest}
              className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
            >
              ▶ Play
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
          >
            Remove
          </button>
        </>
      )}
    </div>
  );
}

function VoiceoverSettingsPanel() {
  const [settings, setSettings] = useState<BrainstormingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [uploadingField, setUploadingField] = useState<'music_url' | 'correct_sound_url' | 'wrong_sound_url' | null>(null);

  const musicInputRef = useRef<HTMLInputElement>(null);
  const correctInputRef = useRef<HTMLInputElement>(null);
  const wrongInputRef = useRef<HTMLInputElement>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2200);
  }

  useEffect(() => {
    loadBrainstormingSettings()
      .then(setSettings)
      .catch((err: unknown) => showToast(err instanceof Error ? err.message : 'Failed to load voiceover settings.'))
      .finally(() => setLoading(false));

    function refreshVoices() {
      setVoices(listVoices());
    }
    refreshVoices();
    // Voice list loads asynchronously in most browsers.
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = refreshVoices;
    }
    return () => stopTensionMusic();
  }, []);

  async function persist(patch: Partial<BrainstormingSettings>) {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    try {
      await saveBrainstormingSettings(settings.id, {
        music_enabled: next.music_enabled,
        voice_enabled: next.voice_enabled,
        voice_style: next.voice_style,
        voice_uri: next.voice_uri,
        music_url: next.music_url,
        correct_sound_url: next.correct_sound_url,
        wrong_sound_url: next.wrong_sound_url,
      });
      showToast('Saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAudioUpload(field: 'music_url' | 'correct_sound_url' | 'wrong_sound_url', file: File) {
    setUploadingField(field);
    try {
      const result = await uploadAudio(file);
      await persist({ [field]: result.url });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploadingField(null);
    }
  }

  if (loading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;
  }
  if (!settings) return null;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <h3 className="mb-1 text-base font-bold text-slate-900">Voiceover &amp; Music</h3>
      <p className="mb-4 text-sm text-slate-500">
        Background tension music plays while a question is live; a spoken reaction plays once it's answered.
        Voices use the browser's own text-to-speech — not a real person's voice.
      </p>

      <div className="space-y-4">
        <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
          <span className="text-sm font-medium text-slate-700">Background music per question</span>
          <input type="checkbox" checked={settings.music_enabled} onChange={(e) => persist({ music_enabled: e.target.checked })} className="h-5 w-5" />
        </label>

        <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
          <span className="text-sm font-medium text-slate-700">Spoken reaction on right/wrong answer</span>
          <input type="checkbox" checked={settings.voice_enabled} onChange={(e) => persist({ voice_enabled: e.target.checked })} className="h-5 w-5" />
        </label>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Announcer style</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {VOICE_STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => persist({ voice_style: opt.value })}
                className={`rounded-xl border p-3 text-left transition ${
                  settings.voice_style === opt.value ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <p className="text-sm font-semibold text-slate-800">{opt.label}</p>
                <p className="text-xs text-slate-400">{opt.hint}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">System voice (optional)</label>
          <select
            value={settings.voice_uri}
            onChange={(e) => persist({ voice_uri: e.target.value })}
            className={INPUT_CLS}
          >
            <option value="">Browser default</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>
            ))}
          </select>
          {voices.length === 0 && (
            <p className="mt-1 text-xs text-slate-400">No system voices detected in this browser yet — the default will be used.</p>
          )}
        </div>

        <div className="border-t border-slate-100 pt-4">
          <p className="mb-1 text-sm font-semibold text-slate-700">Custom Audio (optional)</p>
          <p className="mb-3 text-xs text-slate-500">
            Upload your own recording — e.g. your own mimicry/impression — and it plays instead of the browser voice and
            generated music above. Since it's audio you recorded and uploaded yourself, there's no copyright concern on our end.
          </p>

          <div className="space-y-3">
            <AudioUploadRow
              label="Background Music"
              url={settings.music_url}
              uploading={uploadingField === 'music_url'}
              inputRef={musicInputRef}
              onUpload={(f) => handleAudioUpload('music_url', f)}
              onRemove={() => persist({ music_url: '' })}
              onTest={() => startCustomMusic(settings.music_url)}
              onStopTest={() => stopCustomMusic()}
              holdToTest
            />
            <AudioUploadRow
              label="Correct Answer Sound"
              url={settings.correct_sound_url}
              uploading={uploadingField === 'correct_sound_url'}
              inputRef={correctInputRef}
              onUpload={(f) => handleAudioUpload('correct_sound_url', f)}
              onRemove={() => persist({ correct_sound_url: '' })}
              onTest={() => playCustomSound(settings.correct_sound_url)}
            />
            <AudioUploadRow
              label="Wrong Answer Sound"
              url={settings.wrong_sound_url}
              uploading={uploadingField === 'wrong_sound_url'}
              inputRef={wrongInputRef}
              onUpload={(f) => handleAudioUpload('wrong_sound_url', f)}
              onRemove={() => persist({ wrong_sound_url: '' })}
              onTest={() => playCustomSound(settings.wrong_sound_url)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => speakSample({ style: settings.voice_style, voiceURI: settings.voice_uri || undefined }, true)}
            className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            🔊 Test Browser "Correct"
          </button>
          <button
            type="button"
            onClick={() => speakSample({ style: settings.voice_style, voiceURI: settings.voice_uri || undefined }, false)}
            className="rounded-xl bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100"
          >
            🔊 Test Browser "Wrong"
          </button>
          <button
            type="button"
            onMouseDown={() => startTensionMusic()}
            onMouseUp={() => stopTensionMusic()}
            onMouseLeave={() => stopTensionMusic()}
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            🎵 Hold to Test Generated Music
          </button>
        </div>
      </div>

      {saving && <p className="mt-3 text-xs text-slate-400">Saving…</p>}
      {toast && <p className="mt-3 text-xs font-semibold text-indigo-600">{toast}</p>}
    </div>
  );
}

function BrainstormingManagement() {
  const [items, setItems] = useState<BrainstormingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<BrainstormingItemForm>(defaultBrainstormingItemForm);
  const [saving, setSaving] = useState(false);
  const [listSearch, setListSearch] = useState('');

  const filteredItems = items.filter((item) => {
    const term = listSearch.trim().toLowerCase();
    if (!term) return true;
    return item.question.toLowerCase().includes(term) || item.category.toLowerCase().includes(term);
  });

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    loadItems()
      .then(setItems)
      .catch((err: unknown) => showToast(err instanceof Error ? err.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchAll(); }, []);

  function startNew() {
    setEditingId('new');
    setDraft({ ...defaultBrainstormingItemForm, display_order: items.length });
  }

  function startEdit(item: BrainstormingItem) {
    setEditingId(item.id);
    setDraft({
      question: item.question,
      option_a: item.option_a,
      option_b: item.option_b,
      option_c: item.option_c,
      option_d: item.option_d,
      correct_option: item.correct_option,
      answer: item.answer,
      category: item.category,
      difficulty: item.difficulty,
      active: item.active,
      display_order: item.display_order,
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingId === 'new') {
        await saveItem(draft);
      } else if (editingId) {
        await editItem(editingId, draft);
      }
      setEditingId(null);
      fetchAll();
      showToast('Saved');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await removeItem(id);
      fetchAll();
      showToast('Deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete.');
    }
  }

  function optionText(item: BrainstormingItem): string {
    const map = { a: item.option_a, b: item.option_b, c: item.option_c, d: item.option_d };
    return map[item.correct_option];
  }

  if (loading) {
    return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Brainstorming</h2>
        <p className="mt-1 text-sm text-slate-500">A KBC-style multiple-choice quiz for employee engagement — no scoring saved, shared across every company.</p>
      </div>

      <VoiceoverSettingsPanel />

      {editingId ? (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-base font-bold text-slate-900">{editingId === 'new' ? 'New Question' : 'Edit Question'}</h3>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Question</label>
              <textarea value={draft.question} onChange={(e) => setDraft((d) => ({ ...d, question: e.target.value }))} rows={2} className={INPUT_CLS} />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Options — mark the correct one</label>
              <div className="space-y-2">
                {OPTION_KEYS.map(({ key, letter, label }) => (
                  <div key={key} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, correct_option: letter }))}
                      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                        draft.correct_option === letter ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                      title="Mark as correct"
                    >
                      {label}
                    </button>
                    <input
                      value={draft[key]}
                      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                      placeholder={`Option ${label}`}
                      className={INPUT_CLS}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-400">Click the letter circle to mark which option is correct — it's currently {draft.correct_option.toUpperCase()}.</p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Explanation (shown after answering)</label>
              <textarea value={draft.answer} onChange={(e) => setDraft((d) => ({ ...d, answer: e.target.value }))} rows={2} className={INPUT_CLS} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Category</label>
                <input value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))} placeholder="e.g. Riddles, Logic, Movie in Emoji" className={INPUT_CLS} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500">Difficulty</label>
                <select value={draft.difficulty} onChange={(e) => setDraft((d) => ({ ...d, difficulty: e.target.value as BrainstormingItemForm['difficulty'] }))} className={INPUT_CLS}>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))} />
              Active (visible to employees)
            </label>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button onClick={() => setEditingId(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Save Question'}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-700">All Questions ({filteredItems.length}{filteredItems.length !== items.length ? ` of ${items.length}` : ''})</p>
            <button onClick={startNew} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">+ New Question</button>
          </div>

          <input
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder="Search by question or category..."
            className={`${INPUT_CLS} mb-4`}
          />

          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No questions yet — add one above.</p>
          ) : filteredItems.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">No questions match "{listSearch}".</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => (
                <div key={item.id} className="flex flex-col rounded-2xl border border-slate-200 p-4 transition hover:border-indigo-200 hover:shadow-sm">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">{item.category}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{item.difficulty}</span>
                    {!item.active && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-500">Inactive</span>}
                  </div>
                  <p className="line-clamp-3 flex-1 text-sm font-medium text-slate-800">{item.question}</p>
                  <p className="mt-2 truncate text-xs text-emerald-600">✓ {optionText(item)}</p>
                  <div className="mt-3 flex justify-end gap-3 border-t border-slate-100 pt-3">
                    <button onClick={() => startEdit(item)} className="text-xs font-semibold text-indigo-600 hover:underline">Edit</button>
                    <button onClick={() => handleDelete(item.id)} className="text-xs font-semibold text-red-500 hover:underline">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default BrainstormingManagement;
