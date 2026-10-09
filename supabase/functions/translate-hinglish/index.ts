// supabase/functions/translate-hinglish/index.ts
//
// "Read in Hinglish" for employees: turns English training content (the HTML of a page, lesson or project
// description) into natural Hinglish — Hindi written in English letters, the way an Indian sales team actually talks.
//
// COST: free. Uses Google's Gemini free tier (no card needed). One-time setup by the platform owner:
//   1. Get a free key at https://aistudio.google.com/apikey
//   2. supabase secrets set GEMINI_API_KEY=your_key
// Until that secret exists the feature reports itself as unavailable and the employee never sees the button.
//
// Every translated piece is stored in translation_cache (keyed by a hash of the English text), so a given paragraph is
// translated ONCE for the whole platform — every later reader gets it instantly and uses no quota. A daily cap on fresh
// translations protects the free allowance. Tags and attributes are never touched: if the model returns changed
// markup for a piece, that piece is shown in the original English instead of a broken layout.
//
// Test hook: with TRANSLATE_MOCK=true (local lab only) no outside call is made.

import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { corsHeaders, HttpError, jsonResponse, requireEmployeeCaller, serviceClient } from "../_shared/auth.ts";

const MAX_HTML_CHARS = 60000;
const CHUNK_CHARS = 3500;
const DEFAULT_DAILY_CAP = 800; // fresh (uncached) pieces per day, whole platform
const CACHE_VERSION = "hinglish-v1";

const PROMPT = `Translate the HTML below into natural, conversational Hinglish: Hindi written in English (Roman) letters, the way Indian real estate sales teams talk (for example "Yeh project RERA approved hai aur possession 2027 mein milega").
Rules:
- Keep EVERY HTML tag and attribute exactly as it is. Change only the visible text between tags.
- Keep numbers, prices, areas, dates, project names, brand names and terms like RERA, BHK, sqft, GST, PLC, EMI, ROI, CRM in English.
- Keep it simple and friendly. Do not add, remove or explain anything.
- Output ONLY the translated HTML, nothing else (no code fences).`;

function tagSignature(s: string): string {
  return (s.match(/<\/?[a-zA-Z][a-zA-Z0-9]*/g) ?? []).join("");
}

function hasLetters(s: string): boolean {
  return />[^<]*[A-Za-z]{2,}/.test(`>${s.replace(/<[^>]*>/g, ">")}`) || /^[^<]*[A-Za-z]{2,}/.test(s);
}

/** Splits HTML at block boundaries into pieces of at most ~CHUNK_CHARS. */
function splitHtml(html: string): string[] {
  const parts = html.split(/(?<=<\/(?:p|div|li|ul|ol|h[1-6]|table|tr|blockquote|section)>)/i);
  const chunks: string[] = [];
  let cur = "";
  for (const p of parts) {
    if (cur && cur.length + p.length > CHUNK_CHARS) { chunks.push(cur); cur = ""; }
    cur += p;
    // a single huge block: cut on whitespace so a piece never exceeds the model's comfortable size
    while (cur.length > CHUNK_CHARS * 2) {
      const cut = cur.lastIndexOf(">", CHUNK_CHARS * 2);
      const at = cut > CHUNK_CHARS ? cut + 1 : CHUNK_CHARS;
      chunks.push(cur.slice(0, at));
      cur = cur.slice(at);
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Google retires Gemini model names from time to time (2.0 and 2.5 flash already stopped answering new keys), so the
// models are tried in order and the next one is used when one is retired (404) or overloaded (503). GEMINI_MODEL can pin one.
const MODELS = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.5-flash-lite"];

async function callGemini(chunk: string, apiKey: string): Promise<string> {
  const pinned = Deno.env.get("GEMINI_MODEL");
  const models = pinned ? [pinned, ...MODELS.filter((m) => m !== pinned)] : MODELS;
  let rateLimited = false;
  for (const model of models) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: `${PROMPT}\n\n${chunk}` }] }],
        generationConfig: { temperature: 0.2 },
      }),
    });
    if (res.status === 429) { rateLimited = true; continue; }
    if (res.status === 404 || res.status === 503) continue;
    if (!res.ok) throw new HttpError(502, "The translation service did not answer. Please try again shortly.");
    const json = await res.json();
    const text: string = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    return text.replace(/^```(?:html)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  }
  if (rateLimited) throw new HttpError(429, "Translation is busy right now — please try again in a minute.");
  throw new HttpError(502, "The translation service is busy. Please try again in a minute.");
}

function mockTranslate(chunk: string): string {
  return chunk.replace(/>([^<>]+)</g, (_m, t: string) => `>(Hinglish) ${t}<`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = serviceClient();
    await requireEmployeeCaller(req, admin);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    const mock = Deno.env.get("TRANSLATE_MOCK") === "true";
    const enabled = !!apiKey || mock;

    const body = await req.json().catch(() => ({}));
    if (body?.action === "status") return jsonResponse({ enabled });
    if (!enabled) throw new HttpError(503, "Hinglish translation is not switched on yet.");

    const html = typeof body?.html === "string" ? body.html : "";
    if (!html.trim()) return jsonResponse({ html: "" });
    if (html.length > MAX_HTML_CHARS) throw new HttpError(413, "This page is too long to translate in one go.");

    const chunks = splitHtml(html);
    const hashes = await Promise.all(chunks.map((c) => sha256(`${CACHE_VERSION}:${c}`)));

    const { data: cached, error: cacheError } = await admin.from("translation_cache").select("hash, result").in("hash", hashes);
    if (cacheError) throw new HttpError(500, "Could not read saved translations.");
    const known = new Map((cached ?? []).map((r: { hash: string; result: string }) => [r.hash, r.result]));

    const results: string[] = new Array(chunks.length);
    const todo: number[] = [];
    chunks.forEach((c, i) => {
      if (known.has(hashes[i])) results[i] = known.get(hashes[i])!;
      else if (!hasLetters(c)) results[i] = c;
      else todo.push(i);
    });

    if (todo.length > 0) {
      const cap = Number(Deno.env.get("TRANSLATE_DAILY_CAP")) || DEFAULT_DAILY_CAP;
      const day = new Date().toISOString().slice(0, 10);
      const { data: used } = await admin.from("translation_usage").select("calls").eq("day", day).maybeSingle();
      const calls = used?.calls ?? 0;
      if (calls + todo.length > cap) {
        throw new HttpError(429, "Today's free translation limit has been reached. Pages already translated still work — try again tomorrow.");
      }
      await admin.from("translation_usage").upsert({ day, calls: calls + todo.length });

      const rows: { hash: string; lang: string; result: string }[] = [];
      // 3 at a time keeps within the free tier's per-minute limit
      for (let k = 0; k < todo.length; k += 3) {
        await Promise.all(todo.slice(k, k + 3).map(async (i) => {
          const src = chunks[i];
          if (mock) { results[i] = mockTranslate(src); rows.push({ hash: hashes[i], lang: "hinglish", result: results[i] }); return; }
          let out = await callGemini(src, apiKey!);
          if (tagSignature(out) !== tagSignature(src)) out = await callGemini(src, apiKey!); // one retry if the layout changed
          if (!out || tagSignature(out) !== tagSignature(src)) { results[i] = src; return; } // never ship broken markup
          results[i] = out;
          rows.push({ hash: hashes[i], lang: "hinglish", result: out });
        }));
      }
      if (rows.length > 0) await admin.from("translation_cache").upsert(rows);
    }

    return jsonResponse({ html: results.join("") });
  } catch (e) {
    if (e instanceof HttpError) return jsonResponse({ error: e.message }, e.status);
    console.error("[translate-hinglish]", e);
    return jsonResponse({ error: "Translation failed. Please try again." }, 500);
  }
});
