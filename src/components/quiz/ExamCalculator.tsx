// The calculator trainees can open during an exam / live quiz. A full calculator, not just + − × ÷:
// brackets and the proper order of work (2+3×4 = 14), shop-style % (200+10% = 220), √ x² 1/x xʸ,
// memory (MC MR M+ M−), history, and keyboard typing.
// All the maths lives in utils/calcEngine.ts (tested on its own); this file is only the screen.
//
// Floats over the exam screen and docks above the bottom action bar by default; drag the header to move it out of
// the way of whatever it's covering (a question, the Submit bar). Stays mounted (just translated off-screen) while
// closed, so an in-progress calculation — and wherever it was dragged to — survives toggling it.

import { useEffect, useRef, useState } from "react";
import { applyKey, CALC_EMPTY, currentValue, formatNumber, liveValue, type CalcHistoryEntry, type CalcState } from "../../utils/calcEngine";

const BTN = "h-10 sm:h-11 rounded-xl text-base font-semibold active:scale-95 transition-transform select-none";
const NUM_BTN = `${BTN} bg-slate-800 text-white hover:bg-slate-700`;
const OP_BTN = `${BTN} bg-violet-600 text-white hover:bg-violet-500`;
const FN_BTN = `${BTN} bg-slate-700 text-slate-200 hover:bg-slate-600`;
const MEM_BTN = "h-8 rounded-lg text-xs font-bold bg-slate-800/70 text-amber-300 hover:bg-slate-700 active:scale-95 transition-transform select-none";

const KEYBOARD: Record<string, string> = {
  "*": "×", "/": "÷", ",": ".", Enter: "=", "=": "=", Backspace: "⌫", Delete: "C", Escape: "C",
  "+": "+", "-": "-", ".": ".", "^": "^", "%": "%", "(": "(", ")": ")",
};

const HISTORY_MAX = 12;

export default function ExamCalculator({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [state, setState] = useState<CalcState>(CALC_EMPTY);
  // the latest state, updated the instant a key is pressed, so two quick presses never work from an out-of-date screen
  const stateRef = useRef<CalcState>(CALC_EMPTY);
  const [lastExpr, setLastExpr] = useState("");
  const [memory, setMemory] = useState<number | null>(null);
  const [history, setHistory] = useState<CalcHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Drag offset from the default docked position (0,0 = docked bottom-center).
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null);

  function handleHeaderDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y, moved: false };
  }
  function handleHeaderMove(e: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
    setOffset({ x: drag.baseX + dx, y: drag.baseY + dy });
  }
  function handleHeaderUp() {
    dragRef.current = null;
  }

  // A drag that ends far off-screen (e.g. the trainee dragged it behind the
  // header) would strand the calculator somewhere they can't reach it again —
  // snap back to docked whenever it's reopened after being dragged badly out of view.
  useEffect(() => {
    if (!open) return;
    const maxY = -window.innerHeight + 160;
    if (offset.y < maxY) setOffset({ x: 0, y: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function press(key: string) {
    const step = applyKey(stateRef.current, key);
    stateRef.current = step.state;
    setState(step.state);
    setLastExpr(step.entry ? step.entry.expr : "");
    if (step.entry) {
      const entry = step.entry;
      setHistory((h) => [entry, ...h].slice(0, HISTORY_MAX));
    }
  }

  function memoryAdd(sign: 1 | -1) {
    const v = currentValue(stateRef.current);
    if (v === null) return;
    setMemory((m) => (m ?? 0) + sign * v);
  }
  function memoryRecall() {
    if (memory !== null) press("#" + formatNumber(memory));
  }

  // Keyboard typing while the calculator is open — but never while the trainee is typing an answer somewhere else.
  const pressRef = useRef(press);
  useEffect(() => { pressRef.current = press; });
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const inCalc = !!t && !!rootRef.current?.contains(t);
      const free = !t || t === document.body || t === document.documentElement;
      if (!inCalc && !free) return; // typing in an answer box, a button elsewhere, etc.
      const key = /^[0-9]$/.test(e.key) ? e.key : KEYBOARD[e.key];
      if (!key) return;
      e.preventDefault();
      pressRef.current(key);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const composite = !/^-?[0-9.]*$/.test(state.expr);
  const smallLine = state.error ? "" : state.done ? (lastExpr ? `${lastExpr} =` : "") : composite ? state.expr : "";
  const bigLine = state.error ? "Error" : liveValue(state) || state.expr;

  return (
    <div
      ref={rootRef}
      className="fixed inset-x-0 z-40 px-2"
      style={{
        bottom: "72px",
        transform: open ? `translate(${offset.x}px, ${offset.y}px)` : "translateY(130%)",
        transition: dragRef.current ? "none" : "transform 0.2s ease-out",
      }}
      aria-hidden={!open}
    >
      <div className="max-w-md mx-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div
          onPointerDown={handleHeaderDown}
          onPointerMove={handleHeaderMove}
          onPointerUp={handleHeaderUp}
          onPointerCancel={handleHeaderUp}
          className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800 cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide truncate">⠿ 🧮 Calculator</span>
          <div className="flex items-center gap-1 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowHistory((v) => !v)}
              className={`text-xs px-2 py-1 rounded-md ${showHistory ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white"}`}
              aria-pressed={showHistory}
              title="Earlier calculations"
            >
              🕘
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-white text-sm px-2 py-1" aria-label="Close calculator">✕ Close</button>
          </div>
        </div>

        <div className="relative px-4 pt-2 pb-1 text-right min-h-[3.75rem]">
          {memory !== null && <span className="absolute left-4 top-2 text-[10px] font-bold text-amber-300 bg-amber-300/10 rounded px-1.5 py-0.5" title="A number is stored in memory">M</span>}
          <div className="text-[11px] text-slate-400 truncate min-h-[1rem] font-mono" dir="ltr">{smallLine}</div>
          <div className={`text-2xl font-mono font-bold truncate ${state.error ? "text-red-400" : state.done || !composite ? "text-white" : "text-slate-200"}`}>{bigLine}</div>
        </div>

        {showHistory && (
          <div className="mx-3 mb-2 rounded-xl border border-slate-700 bg-slate-950/60 max-h-36 overflow-y-auto">
            {history.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-500">Your calculations will appear here. Tap one to use its answer.</p>
            ) : (
              <>
                {history.map((h, i) => (
                  <button
                    key={`${h.expr}-${i}`}
                    onClick={() => { press("#" + h.result); setShowHistory(false); }}
                    className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-xs font-mono hover:bg-slate-800"
                  >
                    <span className="truncate text-slate-400">{h.expr} =</span>
                    <span className="shrink-0 font-bold text-white">{h.result}</span>
                  </button>
                ))}
                <button onClick={() => setHistory([])} className="w-full px-3 py-1.5 text-right text-[11px] text-slate-500 hover:text-slate-300">Clear history</button>
              </>
            )}
          </div>
        )}

        {/* mousedown is blocked so a tapped key never grabs keyboard focus (Enter would then press it a second time) */}
        <div className="px-3 pb-3 pt-1 space-y-1.5" onMouseDown={(e) => e.preventDefault()}>
          <div className="grid grid-cols-5 gap-1.5">
            <button onClick={() => setMemory(null)} className={MEM_BTN} title="Memory clear">MC</button>
            <button onClick={memoryRecall} className={MEM_BTN} title="Memory recall">MR</button>
            <button onClick={() => memoryAdd(1)} className={MEM_BTN} title="Add the shown number to memory">M+</button>
            <button onClick={() => memoryAdd(-1)} className={MEM_BTN} title="Subtract the shown number from memory">M−</button>
            <button onClick={() => press("⌫")} className={MEM_BTN} aria-label="Backspace">⌫</button>

            <button onClick={() => press("C")} className={FN_BTN}>C</button>
            <button onClick={() => press("(")} className={FN_BTN}>(</button>
            <button onClick={() => press(")")} className={FN_BTN}>)</button>
            <button onClick={() => press("%")} className={FN_BTN} title="Percent: 200 + 10 % = 220">%</button>
            <button onClick={() => press("÷")} className={OP_BTN} aria-label="Divide">÷</button>

            <button onClick={() => press("√")} className={FN_BTN} title="Square root">√</button>
            <button onClick={() => press("7")} className={NUM_BTN}>7</button>
            <button onClick={() => press("8")} className={NUM_BTN}>8</button>
            <button onClick={() => press("9")} className={NUM_BTN}>9</button>
            <button onClick={() => press("×")} className={OP_BTN} aria-label="Multiply">×</button>

            <button onClick={() => press("x²")} className={FN_BTN} title="Square">x²</button>
            <button onClick={() => press("4")} className={NUM_BTN}>4</button>
            <button onClick={() => press("5")} className={NUM_BTN}>5</button>
            <button onClick={() => press("6")} className={NUM_BTN}>6</button>
            <button onClick={() => press("-")} className={OP_BTN} aria-label="Subtract">−</button>

            <button onClick={() => press("1/x")} className={FN_BTN} title="One divided by the number">1/x</button>
            <button onClick={() => press("1")} className={NUM_BTN}>1</button>
            <button onClick={() => press("2")} className={NUM_BTN}>2</button>
            <button onClick={() => press("3")} className={NUM_BTN}>3</button>
            <button onClick={() => press("+")} className={OP_BTN} aria-label="Add">+</button>

            <button onClick={() => press("^")} className={FN_BTN} title="Power: 2 xʸ 3 = 8">xʸ</button>
            <button onClick={() => press("±")} className={FN_BTN} title="Change sign">±</button>
            <button onClick={() => press("0")} className={NUM_BTN}>0</button>
            <button onClick={() => press(".")} className={NUM_BTN}>.</button>
            <button onClick={() => press("=")} className="h-10 sm:h-11 rounded-xl text-base font-semibold bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 transition-transform select-none">=</button>
          </div>
        </div>
      </div>
    </div>
  );
}
