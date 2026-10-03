// The label in front of an Induction day's title, and which days form the day-by-day order.
//
// Two separate choices, made by the admin day by day:
//
//  1. the LABEL (only what is written before the title)
//       null / undefined  automatic — "Day 1", "Day 2"… (only automatic days are counted)
//       ''                no label — just the title (e.g. the title already says "Day 2 - Real Estate")
//       any text          exactly as typed ("Day 0", "Week 1", "Orientation"…)
//
//  2. STANDALONE (is it one of the days at all?)
//       false  a normal day: it follows the day before it, and the next day follows it
//       true   a company overview, a welcome video…: always open, nothing needed before it, it does not
//              hold the next day back, and it is not counted when days are numbered
//
// "In the order" = every day except the standalone ones. The first day in the order is open from the
// start; every later one opens according to its own rule, after the PREVIOUS day in the order.

export interface LabelledDay { day_label?: string | null; standalone?: boolean | null }

/** A standalone part: outside the day-by-day order. */
export function isStandaloneDay(day: LabelledDay): boolean {
  return day.standalone === true;
}

/** One label per day, in the given order. '' means "show no label". */
export function dayLabels(days: LabelledDay[]): string[] {
  let n = 0;
  return days.map((d) => {
    if (d.day_label === null || d.day_label === undefined) {
      if (d.standalone === true) return ''; // a standalone part is not a day, so it gets no automatic number
      n += 1;
      return `Day ${n}`;
    }
    return d.day_label.trim();
  });
}

/** Index of the previous day that is in the order (skipping standalone parts), or -1 if there is none. */
export function previousInOrder(days: LabelledDay[], index: number): number {
  for (let j = index - 1; j >= 0; j--) if (!isStandaloneDay(days[j])) return j;
  return -1;
}

/** Index of the next day that is in the order (skipping standalone parts), or -1 if there is none. */
export function nextInOrder(days: LabelledDay[], index: number): number {
  for (let j = index + 1; j < days.length; j++) if (!isStandaloneDay(days[j])) return j;
  return -1;
}

/** "Day 1: Company Overview", or just "Company Overview" when the day has no label. */
export function withLabel(label: string, title: string): string {
  return label ? `${label}: ${title}` : title;
}

/** How to refer to a day inside a sentence ("Complete Day 2 first"): its label, or its title when it has none. */
export function refName(label: string, title: string): string {
  return label || title;
}
