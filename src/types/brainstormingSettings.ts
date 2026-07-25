export type BrainstormingVoiceStyle = "classic" | "energetic" | "dramatic";

export interface BrainstormingSettings {
  id: string;
  music_enabled: boolean;
  voice_enabled: boolean;
  voice_style: BrainstormingVoiceStyle;
  voice_uri: string;
  // Admin-uploaded audio — their own recording (e.g. their own
  // mimicry/impression). Takes priority over the generated tension
  // music / browser TTS when set.
  music_url: string;
  correct_sound_url: string;
  wrong_sound_url: string;
  updated_at: string;
}

export type BrainstormingSettingsForm = Pick<
  BrainstormingSettings,
  "music_enabled" | "voice_enabled" | "voice_style" | "voice_uri" | "music_url" | "correct_sound_url" | "wrong_sound_url"
>;

export const defaultBrainstormingSettingsForm: BrainstormingSettingsForm = {
  music_enabled: true,
  voice_enabled: true,
  voice_style: "classic",
  voice_uri: "",
  music_url: "",
  correct_sound_url: "",
  wrong_sound_url: "",
};
