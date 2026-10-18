// The brain of the exam calculator: no screen code, so it can be tested on its own.
//
// - The calculator keeps the sum as text ("200+10%") and works it out with the usual school rules:
//   brackets first, then powers, then × ÷, then + − (so 2+3×4 = 14, not 20).
// - "%" works like a shop calculator: 200+10% = 220, 200−10% = 180, 200×10% = 20, 50% = 0.5.
// - Nothing here uses eval(): a small parser reads the text itself.

const OPS = "+-×÷^";

export interface CalcState {
  /** The sum as typed, or the answer after "=". */
  expr: string;
  /** True right after "=" (or a function key): typing a digit starts a new sum, an operator carries on from the answer. */
  done: boolean;
  /** Something impossible happened (÷0, √ of a negative …). */
  error: boolean;
}

export const CALC_EMPTY: CalcState = { expr: "", done: false, error: false };

export interface CalcHistoryEntry {
  expr: string;
  result: string;
}

const isDigit = (c: string | undefined): boolean => !!c && c.length === 1 && c >= "0" && c <= "9";
const isOp = (c: string | undefined): boolean => !!c && OPS.includes(c);
/** Characters after which a number/bracket/function result "ends" (so a new value needs a × in between). */
const isValueEnd = (c: string | undefined): boolean => !!c && (isDigit(c) || c === ")" || c === "%" || c === ".");

// ─── number → text ────────────────────────────────────────────────────────────

/** Plain decimal text, ~12 significant digits, never "1e-7" style (the parser reads plain numbers only). */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "Error";
  if (Math.abs(n) < 1e-12) return "0";
  if (Math.abs(n) >= 1e21) return "Error";
  let s = String(Number(n.toPrecision(12)));
  if (s.includes("e")) s = n.toFixed(12).replace(/0+$/, "").replace(/\.$/, "");
  return s === "-0" ? "0" : s;
}

// ─── reading a sum ────────────────────────────────────────────────────────────

type Tok = { t: "num"; v: number } | { t: "op"; v: string };

function tokenize(src: string): Tok[] | null {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (isDigit(c) || c === ".") {
      let j = i;
      while (j < src.length && (isDigit(src[j]) || src[j] === ".")) j++;
      const v = Number(src.slice(i, j));
      if (!Number.isFinite(v)) return null;
      out.push({ t: "num", v });
      i = j;
    } else if ("+-×÷^()%".includes(c)) {
      out.push({ t: "op", v: c });
      i++;
    } else {
      return null;
    }
  }
  return out;
}

/** "5+" → "5", "2×(3+4" → "2×(3+4)": a half-typed sum still shows a live answer. */
function complete(src: string): string {
  let s = src;
  while (s.length > 0 && (isOp(s[s.length - 1]) || s[s.length - 1] === "(")) s = s.slice(0, -1);
  let open = 0;
  for (const c of s) {
    if (c === "(") open++;
    else if (c === ")") open--;
  }
  return s + ")".repeat(Math.max(0, open));
}

interface Val { v: number; pct: boolean }

/** Works the sum out. Returns null when it is empty, impossible (÷0) or not a valid sum. */
export function evaluateExpression(src: string): number | null {
  const toks = tokenize(complete(src));
  if (!toks || toks.length === 0) return null;
  let p = 0;
  const peek = (): Tok | undefined => toks[p];
  const isOpTok = (v: string): boolean => { const k = toks[p]; return !!k && k.t === "op" && k.v === v; };

  function primary(): Val {
    const k = toks![p++];
    if (!k) throw new Error("end");
    if (k.t === "num") return { v: k.v, pct: false };
    if (k.v === "(") {
      const inner = expr();
      if (!isOpTok(")")) throw new Error("close");
      p++;
      return { v: inner, pct: false };
    }
    throw new Error("unexpected");
  }
  function postfix(): Val {
    let r = primary();
    while (isOpTok("%")) {
      p++;
      r = { v: r.v / 100, pct: true };
    }
    return r;
  }
  function unary(): Val {
    if (isOpTok("-")) { p++; const r = unary(); return { v: -r.v, pct: false }; }
    if (isOpTok("+")) { p++; return unary(); }
    return postfix();
  }
  function power(): Val {
    const base = unary();
    if (isOpTok("^")) {
      p++;
      const exp = power(); // right-to-left: 2^3^2 = 2^9
      return { v: Math.pow(base.v, exp.v), pct: false };
    }
    return base;
  }
  function term(): Val {
    let left = power();
    let single = true;
    while (isOpTok("×") || isOpTok("÷")) {
      const op = (peek() as { v: string }).v;
      p++;
      const right = power();
      left = { v: op === "×" ? left.v * right.v : left.v / right.v, pct: false };
      single = false;
    }
    return single ? left : { v: left.v, pct: false };
  }
  function expr(): number {
    let left = term().v;
    while (isOpTok("+") || isOpTok("-")) {
      const op = (peek() as { v: string }).v;
      p++;
      const right = term();
      // "200 + 10%" means 10% OF 200 (shop-calculator rule)
      const amount = right.pct ? left * right.v : right.v;
      left = op === "+" ? left + amount : left - amount;
    }
    return left;
  }

  try {
    const v = expr();
    if (p !== toks.length) return null;
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

// ─── editing the sum key by key ───────────────────────────────────────────────

function trailingNumber(expr: string): { start: number; text: string } | null {
  let i = expr.length;
  while (i > 0 && (isDigit(expr[i - 1]) || expr[i - 1] === ".")) i--;
  if (i === expr.length) return null;
  return { start: i, text: expr.slice(i) };
}

function openBrackets(expr: string): number {
  let n = 0;
  for (const c of expr) {
    if (c === "(") n++;
    else if (c === ")") n--;
  }
  return n;
}

const FUNCTIONS: Record<string, (x: number) => number> = {
  "√": (x) => (x < 0 ? NaN : Math.sqrt(x)),
  "x²": (x) => x * x,
  "1/x": (x) => (x === 0 ? NaN : 1 / x),
};

export function isCalcFunction(key: string): boolean {
  return key in FUNCTIONS;
}

export interface CalcStep {
  state: CalcState;
  /** Set when "=" finished a real sum — goes into the history. */
  entry?: CalcHistoryEntry;
}

const fail = (): CalcStep => ({ state: { expr: "", done: false, error: true } });

/**
 * One key press. Keys: "0"-"9" "." "+" "-" "×" "÷" "^" "(" ")" "%" "⌫" "C" "±" "=",
 * the function keys (√ x² 1/x), and "#12.5" to drop in a ready number (memory recall, history).
 */
export function applyKey(prev: CalcState, key: string): CalcStep {
  let s = prev;
  if (s.error) {
    if (key === "C" || key === "⌫") return { state: CALC_EMPTY };
    s = CALC_EMPTY;
  }

  const startsNew = s.done && (isDigit(key) || key === "." || key === "(" || key.startsWith("#"));
  const base = startsNew ? "" : s.expr;
  const last = base[base.length - 1];
  const ok = (expr: string, done = false): CalcStep => ({ state: { expr, done, error: false } });

  if (key.startsWith("#")) {
    const num = key.slice(1);
    return ok((isValueEnd(last) ? base + "×" : base) + num);
  }

  if (isDigit(key)) {
    const b = isValueEnd(last) && !isDigit(last) && last !== "." ? base + "×" : base;
    const tn = trailingNumber(b);
    if (tn && tn.text === "0" && key !== "0") return ok(b.slice(0, -1) + key);
    if (tn && tn.text === "0" && key === "0") return ok(b);
    return ok(b + key);
  }

  if (key === ".") {
    if (isValueEnd(last) && !isDigit(last) && last !== ".") return ok(base + "×0.");
    const tn = trailingNumber(base);
    if (!tn) return ok(base + "0.");
    if (tn.text.includes(".")) return ok(base);
    return ok(base + ".");
  }

  if (isOp(key)) {
    if (base === "") return ok(key === "-" ? "-" : "0" + key);
    if (base === "-") return ok(base);
    if (last === "(") return ok(key === "-" ? base + "-" : base);
    if (isOp(last)) {
      if (key === "-" && "×÷^".includes(last as string)) return ok(base + "-");
      let trimmed = base.slice(0, -1);
      // "5×-" then "+" : drop both
      if (isOp(trimmed[trimmed.length - 1]) && trimmed.length > 1) trimmed = trimmed.slice(0, -1);
      return ok(trimmed + key);
    }
    return ok(base + key);
  }

  if (key === "(") {
    return ok((isValueEnd(last) ? base + "×" : base) + "(");
  }
  if (key === ")") {
    if (openBrackets(base) > 0 && isValueEnd(last)) return ok(base + ")");
    return ok(base, s.done);
  }
  if (key === "%") {
    if (isValueEnd(last) && last !== ".") return ok(base + "%");
    return ok(base, s.done);
  }

  if (key === "⌫") {
    if (base === "") return { state: CALC_EMPTY };
    return ok(base.slice(0, -1));
  }
  if (key === "C") return { state: CALC_EMPTY };

  if (key === "±") {
    if (base === "") return ok("-");
    const tn = trailingNumber(base);
    if (!tn) return ok(base, s.done);
    const a = tn.start;
    const before = base[a - 1];
    if (a === 0) return ok("-" + base);
    if (before === "-") {
      const before2 = base[a - 2];
      if (a - 1 === 0 || isOp(before2) || before2 === "(") return ok(base.slice(0, a - 1) + base.slice(a)); // −5 → 5
      return ok(base.slice(0, a - 1) + "+" + base.slice(a)); // 8−5 → 8+5
    }
    if (before === "+") return ok(base.slice(0, a - 1) + "-" + base.slice(a));
    return ok(base.slice(0, a) + "-" + base.slice(a));
  }

  if (key === "=") {
    if (base === "") return ok("");
    const v = evaluateExpression(base);
    if (v === null) {
      // "5+" → 5 is fine; a real impossibility (÷0) is an error
      const lenient = complete(base);
      return lenient === "" ? ok("") : fail();
    }
    const text = formatNumber(v);
    if (text === "Error") return fail();
    const plain = /^-?[0-9.]+$/.test(base);
    return { state: { expr: text, done: true, error: false }, entry: plain ? undefined : { expr: base, result: text } };
  }

  if (isCalcFunction(key)) {
    const fn = FUNCTIONS[key];
    if (base === "") return ok("", false);
    const tn = trailingNumber(base);
    if (tn && tn.start + tn.text.length === base.length && !isOp(last)) {
      // a minus typed right before the number belongs to it (−4 squared is 16, −4 square-rooted is an error)
      const signed = tn.start > 0 && base[tn.start - 1] === "-" && (tn.start === 1 || isOp(base[tn.start - 2]) || base[tn.start - 2] === "(");
      const from = signed ? tn.start - 1 : tn.start;
      const r = fn((signed ? -1 : 1) * Number(tn.text));
      const text = formatNumber(r);
      if (text === "Error") return fail();
      return ok(base.slice(0, from) + text, s.done);
    }
    const whole = evaluateExpression(base);
    if (whole === null) return fail();
    const r = fn(whole);
    const text = formatNumber(r);
    if (text === "Error") return fail();
    return { state: { expr: text, done: true, error: false } };
  }

  return { state: s };
}

/** What the big line shows: the live answer while typing a sum, or the number itself. */
export function liveValue(state: CalcState): string {
  if (state.error) return "Error";
  if (state.expr === "") return "0";
  if (/^-?[0-9.]+$/.test(state.expr)) return state.expr;
  const v = evaluateExpression(state.expr);
  return v === null ? "" : formatNumber(v);
}

/** The numeric value to store in memory (answer if there is one, else the number being typed). */
export function currentValue(state: CalcState): number | null {
  if (state.error || state.expr === "") return null;
  return evaluateExpression(state.expr);
}
