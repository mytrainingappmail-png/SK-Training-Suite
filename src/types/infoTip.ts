/** One "i" tip: shown next to the control whose visible text is `label`, on the screen `route` ('*' = everywhere). */
export interface InfoTip {
  id: string;
  /** Screen pattern, ids replaced by :id (e.g. "/quiz-admin/host/:id"), or "*" for every screen. */
  route: string;
  /** Visible text of the control the tip belongs to (e.g. "Start over"). */
  label: string;
  title: string | null;
  body: string;
  /** false = hidden from everyone but the platform owner. */
  active: boolean;
}

export interface InfoTipInput {
  id?: string;
  route: string;
  label: string;
  title: string;
  body: string;
  active: boolean;
}

export const INFO_TIP_BODY_MAX = 600;
export const INFO_TIP_TITLE_MAX = 80;
export const INFO_TIP_LABEL_MAX = 80;
export const INFO_TIP_EVERYWHERE = "*";
