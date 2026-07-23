// A real, always-visible "Install App" button. Chrome/Edge/Android decide
// entirely on their own — based on per-origin engagement heuristics the app
// has no access to — whether to fire `beforeinstallprompt` on a given visit,
// so a button that only appears when that event fires ends up looking like
// it randomly disappears. Instead: use the native one-click prompt when the
// browser has offered it, otherwise always show clear manual steps for the
// current browser/OS instead of hiding the button entirely.

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

function getManualSteps(): string[] {
  const ua = navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const isChromeOrEdge = /chrome|edg/.test(ua) && !/opr\//.test(ua);

  if (isIos) {
    return ['Tap the Share icon in Safari\'s toolbar', 'Scroll down and tap "Add to Home Screen"', 'Tap "Add" to confirm'];
  }
  if (isAndroid) {
    return ['Tap the ⋮ menu in your browser', 'Tap "Add to Home screen" or "Install app"', 'Confirm to add it'];
  }
  if (isChromeOrEdge) {
    return ['Look for the install icon (⊕ or a small monitor icon) at the right end of the address bar', 'Or open the ⋮ menu and choose "Install this app…"', 'Confirm to install'];
  }
  return ['This browser doesn\'t support one-click install', 'Try opening this page in Chrome or Edge instead, or bookmark this page for quick access'];
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
  const [showSteps, setShowSteps] = useState(false);

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

  async function handleClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      setDeferredPrompt(null);
      return;
    }
    setShowSteps(true);
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

      {showSteps && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-xl">
          <p className="mb-2 font-semibold text-slate-800">Install this app</p>
          <ol className="list-decimal space-y-1 pl-4 text-slate-600">
            {getManualSteps().map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <button
            onClick={() => setShowSteps(false)}
            className="mt-3 w-full rounded-lg bg-slate-100 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
