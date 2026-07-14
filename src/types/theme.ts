export const FONT_FAMILIES: string[] = [
  "Inter",
  "Roboto",
  "Poppins",
  "Montserrat",
  "Open Sans",
  "Lato",
  "Nunito",
  "System Default",
];

export interface Theme {

  id: string;

  theme_name: string;

  primary_color: string;

  secondary_color: string;

  sidebar_color: string;

  header_color: string;

  logo_url: string;

  favicon_url: string;

  font_family: string;

  dark_mode: boolean;

  active: boolean;

  created_at: string;

  updated_at: string;

}

export type ThemeForm = Omit<
  Theme,
  "id" | "created_at" | "updated_at"
>;

export const defaultThemeForm: ThemeForm = {
  theme_name:      "",
  primary_color:   "#0F172A",
  secondary_color: "#D4AF37",
  sidebar_color:   "#1E293B",
  header_color:    "#FFFFFF",
  logo_url:        "",
  favicon_url:     "",
  font_family:     "Inter",
  dark_mode:       false,
  active:          true,
};
