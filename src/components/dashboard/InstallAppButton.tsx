// A real, visible "Install App" button — the app previously relied entirely
// on the browser's own automatic install UI (Chrome's address-bar icon),
// which is easy to miss and doesn't exist at all on iOS Safari. This adds an
// explicit control: on browsers that support it (Chrome/Edge/Android), it
// captures the native `beforeinstallprompt` event and triggers it on click;
// on iOS Safari, which never fires that event, it shows the manual "Add to
// Home Screen" steps instead. Hides itself once the app is already running
// installed (standalone display mode) or has no install path at all.

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari's own standalone flag — not part of the matchMedia spec.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function IconDownload({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [showIosSteps, setShowIosSteps] = useState(false);
  const ios = isIos();

  useEffect(() => {
    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) return null;
  // Neither a captured native prompt nor iOS's manual path is available —
  // most likely an already-dismissed prompt on desktop Safari/Firefox,
  // which have no install mechanism at all. Nothing useful to show.
  if (!deferredPrompt && !ios) return null;

  async function handleClick() {
    if (ios && !deferredPrompt) {
      setShowIosSteps(true);
      return;
    }
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        title="Install this app on your device"
      >
        <IconDownload />
        <span className="hidden sm:inline">Install App</span>
      </button>

      {showIosSteps && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-xl">
          <p className="mb-2 font-semibold text-slate-800">Add to Home Screen</p>
          <ol className="list-decimal space-y-1 pl-4 text-slate-600">
            <li>Tap the Share icon in Safari's toolbar</li>
            <li>Scroll down and tap "Add to Home Screen"</li>
            <li>Tap "Add" to confirm</li>
          </ol>
          <button
            onClick={() => setShowIosSteps(false)}
            className="mt-3 w-full rounded-lg bg-slate-100 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
