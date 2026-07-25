export type BrainstormingVoiceStyle = "classic" | "energetic" | "dramatic";

export interface BrainstormingSettings {
  id: string;
  music_enabled: boolean;
  voice_enabled: boolean;
  voice_style: BrainstormingVoiceStyle;
  voice_uri: string;
  updated_at: string;
}

export type BrainstormingSettingsForm = Pick<
  BrainstormingSettings,
  "music_enabled" | "voice_enabled" | "voice_style" | "voice_uri"
>;

export const defaultBrainstormingSettingsForm: BrainstormingSettingsForm = {
  music_enabled: true,
  voice_enabled: true,
  voice_style: "classic",
  voice_uri: "",
};
