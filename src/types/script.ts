export interface Script {
  id: string;

  company_id: string;

  title: string;

  content: string;

  // Only ever set-able from the platform operator's own account (frontend
  // gate) — see scripts_module.sql. Copies verbatim through Content
  // Distribution cloning, same as every other field here.
  watermark_enabled: boolean;

  watermark_text: string | null;

  active: boolean;

  created_at: string;

  updated_at: string;
}

export type ScriptForm = Omit<
  Script,
  "id" | "created_at" | "updated_at"
>;

export const defaultScriptForm: ScriptForm = {
  company_id: "",
  title: "",
  content: "",
  watermark_enabled: false,
  watermark_text: null,
  active: true,
};
