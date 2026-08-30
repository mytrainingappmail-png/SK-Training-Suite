import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import SurveyQuestionsForm from "../../components/survey/SurveyQuestionsForm";
import { getSurveyByCode, getSurveyPublicSettings, submitSurveyResponse } from "../../repositories/survey/surveyPublicRepository";
import type { PublicSurvey, SurveyAnswerInput, SurveySettings } from "../../types/survey";

const DEFAULT_COLORS: SurveySettings["option_colors"] = [
  { box: "#7C3AED", font: "#FFFFFF" },
  { box: "#2563EB", font: "#FFFFFF" },
];

export default function SurveyTakePage() {
  const { accessCode } = useParams<{ accessCode: string }>();
  const [survey, setSurvey] = useState<PublicSurvey | null>(null);
  const [settings, setSettings] = useState<Pick<SurveySettings, "option_font_size" | "option_colors">>({ option_font_size: 16, option_colors: DEFAULT_COLORS });
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!accessCode) return;
    Promise.all([getSurveyByCode(accessCode), getSurveyPublicSettings(accessCode)])
      .then(([s, settingsResult]) => {
        if (!s) {
          setError("This survey link isn't available — it may have been closed.");
          return;
        }
        setSurvey(s);
        if (settingsResult && settingsResult.option_colors.length > 0) setSettings(settingsResult);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load this survey."))
      .finally(() => setLoading(false));
  }, [accessCode]);

  async function handleSubmit(answers: SurveyAnswerInput[]) {
    if (!accessCode) return;
    await submitSurveyResponse(accessCode, answers);
    setSubmitted(true);
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-500 text-sm">Loading…</div>;

  if (error && !survey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="max-w-sm text-center text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-2xl px-5 py-4">{error}</div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
        <div className="max-w-sm text-center bg-slate-900 border border-slate-800 rounded-2xl p-8">
          <div className="text-4xl mb-3">✅</div>
          <h1 className="text-lg font-bold text-white mb-1">Thank you</h1>
          <p className="text-sm text-slate-400">Your response has been submitted anonymously.</p>
        </div>
      </div>
    );
  }

  if (!survey) return null;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold text-white">{survey.title}</h1>
          {survey.description && <p className="text-sm text-slate-400 mt-1">{survey.description}</p>}
          <p className="text-[11px] text-slate-500 mt-2">🔒 Fully anonymous — your identity is never collected or stored.</p>
        </div>

        <SurveyQuestionsForm questions={survey.questions} settings={settings} onSubmit={handleSubmit} />
      </div>
    </div>
  );
}
