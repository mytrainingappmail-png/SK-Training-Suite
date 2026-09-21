import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";

const CHECK_EVERY_MS = 30 * 60 * 1000;

/** Screens where a surprise reload would hurt (someone is mid-exam / mid-quiz / hosting one). */
const BUSY_ROUTE = /^\/(quiz\/play|exam\/[^/]+|survey-live|quiz-admin\/(surveys\/[^/]+\/live|exams\/session|quizzes\/[^/]+\/live))/;

/**
 * Keeps every device on the latest version without anyone having to hit refresh:
 *  - asks for a new version every 30 minutes and whenever the app is brought back to the foreground
 *    (installed apps can otherwise stay open for days on an old build);
 *  - on normal screens the new version is applied straight away;
 *  - on a busy screen (exam, live quiz, survey) it waits and shows a small banner, and applies the
 *    update as soon as the person leaves that screen or taps "Update now".
 */
export default function UpdatePrompt() {
  const { pathname } = useLocation();
  const [waiting, setWaiting] = useState(false);
  const updateRef = useRef<((reload?: boolean) => Promise<void>) | null>(null);
  const busyRef = useRef(false);
  busyRef.current = BUSY_ROUTE.test(pathname);

  useEffect(() => {
    let registration: ServiceWorkerRegistration | undefined;
    const update = registerSW({
      onNeedRefresh() {
        if (busyRef.current) setWaiting(true);
        else void update(true);
      },
      onRegisteredSW(_url, reg) {
        registration = reg;
      },
    });
    updateRef.current = update;

    const check = () => { void registration?.update().catch(() => { /* offline - try again later */ }); };
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // The moment they leave the busy screen, apply the update that was waiting.
  useEffect(() => {
    if (waiting && !BUSY_ROUTE.test(pathname)) {
      setWaiting(false);
      void updateRef.current?.(true);
    }
  }, [pathname, waiting]);

  if (!waiting) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-3 rounded-full bg-slate-900 px-4 py-2 text-xs text-white shadow-lg">
      <span>A new version is ready — it will install when you finish here.</span>
      <button onClick={() => void updateRef.current?.(true)} className="rounded-full bg-amber-400 px-3 py-1 font-semibold text-slate-900">Update now</button>
    </div>
  );
}
