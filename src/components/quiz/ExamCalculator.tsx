// A basic 4-function calculator for the exam paper — slides up from the
// bottom as its own strip, sitting ABOVE the existing Questions/Submit bar
// rather than covering the question above it, so a candidate can read the
// numbers in the question and use the calculator at the same time without
// either one blocking the other. Stays mounted (just translated off-screen)
// while closed, so an in-progress calculation survives opening and closing
// it mid-question.

import { useState } from "react";

type Op = "+" | "-" | "×" | "÷";

const BTN = "h-12 rounded-xl text-base font-semibold active:scale-95 transition-transform";
const NUM_BTN = `${BTN} bg-slate-800 text-white hover:bg-slate-700`;
const OP_BTN = `${BTN} bg-violet-600 text-white hover:bg-violet-500`;
const FN_BTN = `${BTN} bg-slate-700 text-slate-200 hover:bg-slate-600`;

function compute(a: number, b: number, op: Op): number {
  if (op === "+") return a + b;
  if (op === "-") return a - b;
  if (op === "×") return a * b;
  return b === 0 ? NaN : a / b;
}

function formatResult(n: number): string {
  if (!Number.isFinite(n)) return "Error";
  // Round away long floating-point tails (0.1 + 0.2 artifacts) without
  // truncating a genuinely large/precise result.
  return String(Math.round(n * 1e9) / 1e9);
}

export default function ExamCalculator({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<Op | null>(null);
  const [justEvaluated, setJustEvaluated] = useState(false);

  function inputDigit(d: string) {
    if (justEvaluated) {
      setDisplay(d === "." ? "0." : d);
      setJustEvaluated(false);
      return;
    }
    if (d === "." && display.includes(".")) return;
    setDisplay((prev) => (prev === "0" && d !== "." ? d : prev + d));
  }

  function clearAll() {
    setDisplay("0");
    setStored(null);
    setPendingOp(null);
    setJustEvaluated(false);
  }

  function backspace() {
    setDisplay((prev) => (prev.length > 1 ? prev.slice(0, -1) : "0"));
  }

  function toggleSign() {
    setDisplay((prev) => (prev.startsWith("-") ? prev.slice(1) : prev === "0" ? prev : "-" + prev));
  }

  function percent() {
    setDisplay((prev) => formatResult(parseFloat(prev) / 100));
  }

  function applyOp(op: Op) {
    const current = parseFloat(display);
    if (stored !== null && pendingOp && !justEvaluated) {
      const result = compute(stored, current, pendingOp);
      setStored(result);
      setDisplay(formatResult(result));
    } else {
      setStored(current);
    }
    setPendingOp(op);
    // The digit typed next starts a fresh second operand instead of being
    // appended onto the first one — without this, "1" then "+" then "3"
    // read as display "1" + "3" = "13", not two separate numbers.
    setJustEvaluated(true);
  }

  function equals() {
    if (stored === null || !pendingOp) return;
    setDisplay(formatResult(compute(stored, parseFloat(display), pendingOp)));
    setStored(null);
    setPendingOp(null);
    setJustEvaluated(true);
  }

  return (
    <div
      className="fixed inset-x-0 z-40 transition-transform duration-200 px-2"
      style={{ bottom: "72px", transform: open ? "translateY(0)" : "translateY(130%)" }}
      aria-hidden={!open}
    >
      <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">🧮 Calculator</span>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm px-2 py-1" aria-label="Close calculator">✕ Close</button>
        </div>
        <div className="px-4 pt-2 pb-1 text-right min-h-[2rem]">
          {pendingOp && <div className="text-[11px] text-slate-500 truncate">{formatResult(stored ?? 0)} {pendingOp}</div>}
          <div className="text-2xl font-mono font-bold text-white truncate">{display}</div>
        </div>
        <div className="grid grid-cols-4 gap-1.5 px-3 pb-3 pt-1">
          <button onClick={clearAll} className={FN_BTN}>C</button>
          <button onClick={toggleSign} className={FN_BTN}>±</button>
          <button onClick={percent} className={FN_BTN}>%</button>
          <button onClick={() => applyOp("÷")} className={OP_BTN}>÷</button>

          <button onClick={() => inputDigit("7")} className={NUM_BTN}>7</button>
          <button onClick={() => inputDigit("8")} className={NUM_BTN}>8</button>
          <button onClick={() => inputDigit("9")} className={NUM_BTN}>9</button>
          <button onClick={() => applyOp("×")} className={OP_BTN}>×</button>

          <button onClick={() => inputDigit("4")} className={NUM_BTN}>4</button>
          <button onClick={() => inputDigit("5")} className={NUM_BTN}>5</button>
          <button onClick={() => inputDigit("6")} className={NUM_BTN}>6</button>
          <button onClick={() => applyOp("-")} className={OP_BTN}>−</button>

          <button onClick={() => inputDigit("1")} className={NUM_BTN}>1</button>
          <button onClick={() => inputDigit("2")} className={NUM_BTN}>2</button>
          <button onClick={() => inputDigit("3")} className={NUM_BTN}>3</button>
          <button onClick={() => applyOp("+")} className={OP_BTN}>+</button>

          <button onClick={backspace} className={FN_BTN}>⌫</button>
          <button onClick={() => inputDigit("0")} className={NUM_BTN}>0</button>
          <button onClick={() => inputDigit(".")} className={NUM_BTN}>.</button>
          <button onClick={equals} className="h-12 rounded-xl text-base font-semibold bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 transition-transform">=</button>
        </div>
      </div>
    </div>
  );
}
