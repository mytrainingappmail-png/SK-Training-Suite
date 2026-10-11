// Shared Gemini caller for edge functions that need the platform's free Google AI key (GEMINI_API_KEY).
// Google retires model names from time to time and the free tier is often "busy", so models are tried in order: the next
// one is used when one is retired (404), overloaded (503/500), rate limited (429) or simply too slow. Every attempt has its
// own time limit — without it one hung model used up the whole function time and the user only saw a generic failure.
// GEMINI_MODEL can pin a preferred one. The key travels in a header, never in a URL.

import { HttpError } from "./auth.ts";

// Fast, dependable models first; the "latest" alias last because it was seen hanging for minutes.
const MODELS = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-flash-latest"];
const PER_MODEL_MS = 28_000;
const TOTAL_MS = 110_000;

export async function callGemini(
  prompt: string,
  apiKey: string,
  opts: { json?: boolean; temperature?: number } = {}
): Promise<string> {
  const pinned = Deno.env.get("GEMINI_MODEL");
  const models = pinned ? [pinned, ...MODELS.filter((m) => m !== pinned)] : MODELS;
  const started = Date.now();
  let rateLimited = false;
  let timedOut = false;

  for (const model of models) {
    const left = TOTAL_MS - (Date.now() - started);
    if (left < 4_000) break;
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: opts.temperature ?? 0.4,
            ...(opts.json ? { responseMimeType: "application/json" } : {}),
          },
        }),
        signal: AbortSignal.timeout(Math.min(PER_MODEL_MS, left)),
      });
      if (res.status === 429) { rateLimited = true; continue; }
      if (res.status === 404 || res.status === 500 || res.status === 503) continue;
      if (!res.ok) throw new HttpError(502, "The AI service did not answer. Please try again shortly.");
      const json = await res.json();
      const text: string = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
      if (!text.trim()) continue; // an empty answer — try the next model
      return text.replace(/^```(?:json|html)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    } catch (e) {
      if (e instanceof HttpError) throw e;
      timedOut = true; // aborted (too slow) or a network hiccup — try the next model
    }
  }
  if (rateLimited) throw new HttpError(429, "The AI is busy right now — please try again in a minute.");
  if (timedOut) throw new HttpError(504, "The AI took too long to answer. Please try once more.");
  throw new HttpError(502, "The AI service is busy. Please try again in a minute.");
}
