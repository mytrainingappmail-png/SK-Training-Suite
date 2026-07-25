import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { supabaseQuiz } from "../../lib/supabaseQuiz";
import { ROUTES } from "../../constants/routes";
import { loadCurrentQuizAdmin, clearCurrentQuizAdmin } from "../../services/quiz/quizAdminSession";

type GuardState = "checking" | "ok" | "no-session" | "module-disabled";

/**
 * Gate for every /quiz-admin/* route. Two independent checks, both
 * enforced again server-side (RLS / current_quiz_admin_company_id) so
 * this component is a UX convenience, not the real security boundary:
 *   1. a live quiz-admin Supabase Auth session exists on supabaseQuiz
 *   2. the company still has live_quiz_enabled = true right now
 */
export default function QuizAdminGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GuardState>("checking");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const cachedAdmin = loadCurrentQuizAdmin();
      const { data } = await supabaseQuiz.auth.getSession();

      if (!cachedAdmin || !data.session) {
        clearCurrentQuizAdmin();
        if (!cancelled) setState("no-session");
        return;
      }

      const { data: flagRows, error } = await supabaseQuiz.rpc("get_my_quiz_company_flag");
      if (cancelled) return;

      const flag = (flagRows as { company_id: string; live_quiz_enabled: boolean }[] | null)?.[0];
      if (error || !flag) {
        clearCurrentQuizAdmin();
        setState("no-session");
        return;
      }

      setState(flag.live_quiz_enabled ? "ok" : "module-disabled");
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="h-8 w-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (state === "no-session") {
    return <Navigate to={ROUTES.QUIZ_ADMIN_LOGIN} replace />;
  }

  if (state === "module-disabled") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-200 px-6">
        <div className="max-w-md text-center space-y-3">
          <div className="text-3xl">🔒</div>
          <h1 className="text-lg font-semibold">Live Quiz is not enabled</h1>
          <p className="text-sm text-slate-400">
            This company's access to the Live Quiz module has been turned off. Contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
