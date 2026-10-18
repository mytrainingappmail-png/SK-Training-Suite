import { describe, it, expect } from "vitest";
import { applyKey, CALC_EMPTY, evaluateExpression, liveValue, type CalcState } from "../calcEngine";

function press(keys: string[], from: CalcState = CALC_EMPTY): CalcState {
  return keys.reduce((s, k) => applyKey(s, k).state, from);
}
/** Types the sum, presses "=", returns what the display shows. */
function calc(keys: string): string {
  const s = press([...keys].map((k) => (k === "*" ? "×" : k === "/" ? "÷" : k)).concat("="));
  return s.error ? "Error" : s.expr;
}

describe("percent works like a shop calculator", () => {
  it("adds a percentage of the first number", () => {
    expect(calc("200+10%")).toBe("220");
    expect(calc("1000+18%")).toBe("1180");
  });
  it("subtracts a percentage of the first number", () => {
    expect(calc("200-10%")).toBe("180");
    expect(calc("5000-20%")).toBe("4000");
  });
  it("takes a percentage with ×", () => {
    expect(calc("200*10%")).toBe("20");
    expect(calc("2500000*2%")).toBe("50000");
  });
  it("divides by a percentage", () => {
    expect(calc("50/50%")).toBe("100");
  });
  it("turns a lone number into a fraction", () => {
    expect(calc("50%")).toBe("0.5");
    expect(calc("7.5%")).toBe("0.075");
  });
  it("shows the live answer while typing", () => {
    expect(liveValue(press(["2", "0", "0", "+", "1", "0", "%"]))).toBe("220");
  });
  it("keeps going after a percent answer", () => {
    const s = press(["2", "0", "0", "+", "1", "0", "%", "=", "×", "2", "="]);
    expect(s.expr).toBe("440");
  });
});

describe("school-maths order of work", () => {
  it("× and ÷ before + and −", () => {
    expect(calc("2+3*4")).toBe("14");
    expect(calc("10-6/2")).toBe("7");
  });
  it("brackets first", () => {
    expect(calc("(2+3)*4")).toBe("20");
    expect(calc("2*(3+4)")).toBe("14");
  });
  it("closes missing brackets and ignores a dangling operator", () => {
    expect(evaluateExpression("(2+3")).toBe(5);
    expect(evaluateExpression("5+")).toBe(5);
    expect(evaluateExpression("")).toBeNull();
  });
  it("powers", () => {
    expect(calc("2^10")).toBe("1024");
    expect(calc("2^3^2")).toBe("512");
  });
  it("no floating-point tails", () => {
    expect(calc("0.1+0.2")).toBe("0.3");
    expect(calc("1/3")).toBe("0.333333333333");
  });
  it("divide by zero is an error", () => {
    expect(calc("5/0")).toBe("Error");
  });
});

describe("typing", () => {
  it("does not stack zeros or dots", () => {
    expect(press(["0", "0", "5"]).expr).toBe("5");
    expect(press(["1", ".", "5", "."]).expr).toBe("1.5");
    expect(press(["."]).expr).toBe("0.");
    expect(press(["4", "+", "."]).expr).toBe("4+0.");
  });
  it("a new operator replaces the last one", () => {
    expect(press(["5", "+", "×"]).expr).toBe("5×");
    expect(press(["5", "×", "-"]).expr).toBe("5×-");
    expect(calc("5*-3")).toBe("-15");
  });
  it("a digit after = starts fresh, an operator carries on", () => {
    expect(press(["2", "+", "3", "=", "7"]).expr).toBe("7");
    expect(press(["2", "+", "3", "=", "×", "4", "="]).expr).toBe("20");
  });
  it("implicit multiplication next to brackets", () => {
    expect(press(["2", "("]).expr).toBe("2×(");
    expect(calc("2(3+1)")).toBe("8");
  });
  it("backspace and clear", () => {
    expect(press(["1", "2", "3", "⌫"]).expr).toBe("12");
    expect(press(["1", "2", "C"]).expr).toBe("");
  });
  it("sign toggle", () => {
    expect(press(["5", "±"]).expr).toBe("-5");
    expect(press(["5", "±", "±"]).expr).toBe("5");
    expect(press(["8", "-", "5", "±"]).expr).toBe("8+5");
  });
});

describe("function keys", () => {
  it("√ x² 1/x on the number being typed", () => {
    expect(press(["9", "√"]).expr).toBe("3");
    expect(press(["1", "2", "x²"]).expr).toBe("144");
    expect(press(["4", "1/x"]).expr).toBe("0.25");
    expect(press(["5", "+", "9", "√"]).expr).toBe("5+3");
  });
  it("whole answer when the sum ends with a bracket", () => {
    expect(press(["(", "3", "+", "1", "3", ")", "√"]).expr).toBe("4");
  });
  it("impossible things show Error and recover on the next key", () => {
    const e = press(["-", "4", "√"]);
    expect(e.error).toBe(true);
    expect(press(["7"], e).expr).toBe("7");
  });
});

describe("history entry", () => {
  it("only for a real sum", () => {
    expect(applyKey(press(["2", "+", "2"]), "=").entry).toEqual({ expr: "2+2", result: "4" });
    expect(applyKey(press(["2"]), "=").entry).toBeUndefined();
  });
});
