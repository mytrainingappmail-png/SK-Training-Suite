import { supabaseQuiz } from "../../lib/supabaseQuiz";
import { supabaseQuizPlayer } from "../../lib/supabaseQuizPlayer";
import type { QuizSettings, QuizPlayerSettings, QuizPublicBranding } from "../../types/quiz";

const DEFAULT_SETTINGS: Omit<QuizSettings, "company_id" | "updated_at"> = {
  brand_name: null,
  brand_tagline: null,
  brand_logo_url: null,
  login_background_url: null,
  login_banner_url: null,
  option_font_size: 16,
  option_colors: [
    { box: "#DC2626", font: "#FFFFFF" },
    { box: "#2563EB", font: "#FFFFFF" },
    { box: "#16A34A", font: "#FFFFFF" },
    { box: "#78350F", font: "#FFFFFF" },
  ],
  sound_enabled: true,
  default_join_mode: "open",
  cert_template: "dark_elegant",
  cert_company_name: null,
  cert_logo_url: null,
  cert_title: "Certificate of Achievement",
  cert_achievement_line: "has successfully completed",
  cert_signatory1_name: null,
  cert_signatory1_title: null,
  cert_signatory1_image_url: null,
  cert_signatory2_name: null,
  cert_signatory2_title: null,
  cert_signatory2_image_url: null,
  champ_music: "builtin",
  champ_music_url: null,
  champ_music_volume: 70,
};

/** Returns saved settings, or sensible defaults if this company has never saved any yet (no row exists until the first Save). */
export async function getSettings(companyId: string): Promise<QuizSettings> {
  const { data, error } = await supabaseQuiz.from("quiz_settings").select("*").eq("company_id", companyId).maybeSingle();

  if (error) {
    console.error("[quizSettingsRepository] getSettings:", error);
    throw new Error(error.message);
  }

  return data ?? { company_id: companyId, updated_at: new Date().toISOString(), ...DEFAULT_SETTINGS };
}

export async function saveSettings(companyId: string, patch: Partial<QuizSettings>): Promise<QuizSettings> {
  const { data, error } = await supabaseQuiz
    .from("quiz_settings")
    .upsert({ company_id: companyId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "company_id" })
    .select()
    .single();

  if (error) {
    console.error("[quizSettingsRepository] saveSettings:", error);
    throw new Error(error.message);
  }

  return data;
}

/** Public, correctness-free subset for the player's own screen — looked up via the session they've joined. */
export async function getPlayerSettings(sessionId: string): Promise<QuizPlayerSettings> {
  const { data, error } = await supabaseQuizPlayer.rpc("get_quiz_player_settings", { p_session_id: sessionId });

  if (error) {
    console.error("[quizSettingsRepository] getPlayerSettings:", error);
    throw new Error(error.message);
  }

  const row = (data as QuizPlayerSettings[] | null)?.[0];
  return row ?? { ...DEFAULT_SETTINGS, brand_name: null, brand_logo_url: null };
}

/** Pre-auth branding for the quiz admin login page — no company context exists yet (global unique usernames, no company code field), so this resolves to the first company with the module enabled, same fallback the main LMS login uses before a company code is typed. */
export async function getPublicQuizBranding(): Promise<QuizPublicBranding | null> {
  const { data, error } = await supabaseQuiz.rpc("get_quiz_public_branding");

  if (error) {
    console.error("[quizSettingsRepository] getPublicQuizBranding:", error);
    return null;
  }

  const row = (data as QuizPublicBranding[] | null)?.[0];
  return row ?? null;
}
