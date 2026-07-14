export const SETTING_GROUPS: string[] = [
  "General",
  "LMS",
  "Assessment",
  "Certificate",
  "Email",
  "Security",
  "Upload",
  "Localization",
];

export interface Setting {

  id: string;

  setting_key: string;

  setting_value: string;

  setting_group: string;

  description: string;

  active: boolean;

  created_at: string;

  updated_at: string;

}

export type SettingForm = Omit<
  Setting,
  "id" | "created_at" | "updated_at"
>;

export const defaultSettingForm: SettingForm = {
  setting_key:   "",
  setting_value: "",
  setting_group: "General",
  description:   "",
  active:        true,
};
