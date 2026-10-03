// The label in front of an Induction day's title. The admin decides it, day by day:
//   null / undefined  automatic — "Day 1", "Day 2"… (only automatic days are counted, so a day without a
//                     number, like a company overview, does not push the numbering forward)
//   ''                no label at all — just the title
//   any text          exactly as typed ("Day 0", "Week 1", "Orientation"…)

export interface LabelledDay { day_label?: string | null }

/** One label per day, in the given order. '' means "show no label". */
export function dayLabels(days: LabelledDay[]): string[] {
  let n = 0;
  return days.map((d) => {
    if (d.day_label === null || d.day_label === undefined) {
      n += 1;
      return `Day ${n}`;
    }
    return d.day_label.trim();
  });
}

/** "Day 1: Company Overview", or just "Company Overview" when the day has no label. */
export function withLabel(label: string, title: string): string {
  return label ? `${label}: ${title}` : title;
}

/** How to refer to a day inside a sentence ("Complete Day 2 first"): its label, or its title when it has none. */
export function refName(label: string, title: string): string {
  return label || title;
}
