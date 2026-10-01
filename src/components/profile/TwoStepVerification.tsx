// src/components/profile/TwoStepVerification.tsx
//
// Lets a signed-in user switch on two-step verification with an authenticator
// app (Google Authenticator, Microsoft Authenticator, Authy…). Once on, signing
// in needs the password AND a 6-digit code, and for an administrator of the
// platform a password alone no longer unlocks anything powerful.

import { useCallback, useEffect, useState } from 'react';

import { supabase } from '../../lib/supabase';

type Status = 'loading' | 'off' | 'enrolling' | 'on';

export default function TwoStepVerification() {
  const [status, setStatus] = useState<Status>('loading');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setMessage({ text: error.message, error: true });
      setStatus('off');
      return;
    }
    const verified = data?.totp?.[0];
    setFactorId(verified?.id ?? null);
    setStatus(verified ? 'on' : 'off');
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function startEnrol() {
    setBusy(true);
    setMessage(null);
    try {
      // Clear out any half-finished setup so the new QR code is the only one.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of existing?.all ?? []) {
        if (f.factor_type === 'totp' && f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator app' });
      if (error || !data) throw new Error(error?.message ?? 'Could not start setup.');
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setCode('');
      setStatus('enrolling');
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Could not start setup.', error: true });
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnrol() {
    if (!factorId) return;
    const cleaned = code.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(cleaned)) {
      setMessage({ text: 'Enter the 6-digit code shown in your authenticator app.', error: true });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError || !challenge) throw new Error(challengeError?.message ?? 'Could not verify.');
      const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: cleaned });
      if (error) throw new Error('That code is not correct or has expired. Try the newest code.');
      setStatus('on');
      setQr('');
      setSecret('');
      setMessage({ text: 'Two-step verification is on. From now on, signing in asks for a code.', error: false });
    } catch (err) {
      setMessage({ text: err instanceof Error ? err.message : 'Verification failed.', error: true });
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnrol() {
    if (factorId) await supabase.auth.mfa.unenroll({ factorId }).catch(() => undefined);
    setQr('');
    setSecret('');
    setFactorId(null);
    setStatus('off');
  }

  async function turnOff() {
    if (!factorId) return;
    if (!confirm('Turn off two-step verification? Your account will be protected by the password alone.')) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) {
      setMessage({ text: error.message, error: true });
      return;
    }
    setFactorId(null);
    setStatus('off');
    setMessage({ text: 'Two-step verification is off.', error: false });
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">Two-step verification</p>
          <p className="text-xs text-slate-500">
            {status === 'on'
              ? 'On — signing in needs your password and a code from your authenticator app.'
              : 'Adds a 6-digit code from your phone to sign-in, so a stolen password alone is useless.'}
          </p>
        </div>
        {status === 'on' && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">On</span>}
      </div>

      {message && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${message.error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {message.text}
        </p>
      )}

      {status === 'off' && (
        <button
          type="button"
          onClick={() => { void startEnrol(); }}
          disabled={busy}
          className="mt-3 rounded-xl border border-slate-800 bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? 'Starting…' : 'Set up'}
        </button>
      )}

      {status === 'enrolling' && (
        <div className="mt-3 space-y-3">
          <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-600">
            <li>Open an authenticator app on your phone (Google Authenticator, Microsoft Authenticator or Authy).</li>
            <li>Choose “Add account”, then scan this picture.</li>
            <li>Type the 6-digit code the app shows, below.</li>
          </ol>
          {qr && <img src={qr} alt="Scan with your authenticator app" className="mx-auto h-44 w-44 rounded-lg border border-slate-200 bg-white p-2" />}
          {secret && (
            <p className="break-all text-center text-[11px] text-slate-500">
              Can’t scan? Type this key into the app instead: <span className="font-mono text-slate-700">{secret}</span>
            </p>
          )}
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, '').slice(0, 7))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-center text-lg tracking-[0.3em] outline-none focus:border-slate-400"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { void cancelEnrol(); }}
              className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => { void confirmEnrol(); }}
              disabled={busy}
              className="flex-1 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {busy ? 'Checking…' : 'Turn on'}
            </button>
          </div>
        </div>
      )}

      {status === 'on' && (
        <button
          type="button"
          onClick={() => { void turnOff(); }}
          disabled={busy}
          className="mt-3 text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
        >
          Turn off
        </button>
      )}
    </div>
  );
}
