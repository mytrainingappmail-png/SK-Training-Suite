// Shared Gemini caller for edge functions that need the platform's free Google AI key (GEMINI_API_KEY).
// Google retires model names from time to time, so models are tried in order: the next one is used when one is retired
// (404) or overloaded (503). GEMINI_MODEL can pin a preferred one. The key travels in a header, never in a URL.

import { HttpError } from "./auth.ts";

const MODELS = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.5-flash-lite"];

export async function callGemini(
  prompt: string,
  apiKey: string,
  opts: { json?: boolean; temperature?: number } = {}
): Promise<string> {
  const pinned = Deno.env.get("GEMINI_MODEL");
  const models = pinned ? [pinned, ...MODELS.filter((m) => m !== pinned)] : MODELS;
  let rateLimited = false;

  for (const model of models) {
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
    });
    if (res.status === 429) { rateLimited = true; continue; }
    if (res.status === 404 || res.status === 503) continue;
    if (!res.ok) throw new HttpError(502, "The AI service did not answer. Please try again shortly.");
    const json = await res.json();
    const text: string = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    return text.replace(/^```(?:json|html)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  }
  if (rateLimited) throw new HttpError(429, "The AI is busy right now — please try again in a minute.");
  throw new HttpError(502, "The AI service is busy. Please try again in a minute.");
}
