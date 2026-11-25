// Client side of AI Summary (edge function summarize-content). A summary is made once per text + language on the server and kept,
// so asking again - by anyone - is instant and costs nothing.

import { supabase } from "../../lib/supabase";

export interface SummaryResult { summary: string; sourceWords: number; summaryWords: number; cached: boolean }

export class SummaryError extends Error {
  readonly notInPlan: boolean;
  constructor(message: string, notInPlan = false) { super(message); this.notInPlan = notInPlan; }
}

export async function summarizeText(content: string, language: "english" | "hinglish"): Promise<SummaryResult> {
  const { data, error } = await supabase.functions.invoke("summarize-content", { body: { content, language } });
  if (error) {
    let message = "Could not make the summary right now. Please try again.";
    let notInPlan = false;
    const res = (error as { context?: Response }).context;
    if (res?.status === 504 || res?.status === 546 || res?.status === 408) message = "The summary is taking too long. Please try once more.";
    else if (res?.status === 401) message = "Your sign-in has expired. Please refresh the page and sign in again.";
    try {
      const body = await res?.json();
      if (body?.error) message = body.error;
      if (body?.code === "module_off") notInPlan = true;
    } catch { /* keep the sentence above */ }
    throw new SummaryError(message, notInPlan);
  }
  return {
    summary: String(data?.summary ?? ""),
    sourceWords: Number(data?.source_words ?? 0),
    summaryWords: Number(data?.summary_words ?? 0),
    cached: !!data?.cached,
  };
}
