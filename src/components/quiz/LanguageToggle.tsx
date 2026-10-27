// A small English / हिंदी switch for the trainee's quiz and exam screens. It is only rendered when the question on screen has a
// Hindi version (the pages decide that). The choice is remembered on the device.

import { setQuizLang, useQuizLang } from "../../services/quiz/quizTranslationService";

export default function LanguageToggle({ className = "" }: { className?: string }) {
  const lang = useQuizLang();
  const base = "px-2.5 py-1 text-[11px] font-bold transition-colors";
  return (
    <div role="group" aria-label="Language" className={`inline-flex overflow-hidden rounded-full border border-slate-600 bg-slate-800 ${className}`}>
      <button type="button" onClick={() => setQuizLang("en")} aria-pressed={lang === "en"} className={`${base} ${lang === "en" ? "bg-violet-600 text-white" : "text-slate-300 hover:text-white"}`}>
        English
      </button>
      <button type="button" onClick={() => setQuizLang("hi")} aria-pressed={lang === "hi"} className={`${base} ${lang === "hi" ? "bg-violet-600 text-white" : "text-slate-300 hover:text-white"}`}>
        हिंदी
      </button>
    </div>
  );
}
