export type MenuLevel = 1 | 2 | 3;

export interface Menu {

  id: string;

  menu_code: string;

  menu_name: string;

  parent_menu_id: string | null;

  route_path: string;

  icon: string;

  display_order: number;

  menu_level: MenuLevel;

  active: boolean;

  created_at: string;

  updated_at: string;

}

export type MenuForm = Omit<
  Menu,
  "id" | "created_at" | "updated_at"
>;

export const defaultMenuForm: MenuForm = {
  menu_code:      "",
  menu_name:      "",
  parent_menu_id: null,
  route_path:     "",
  icon:           "",
  display_order:  0,
  menu_level:     1,
  active:         true,
};

export const MENU_LEVELS: { value: MenuLevel; label: string }[] = [
  { value: 1, label: "Level 1 — Top" },
  { value: 2, label: "Level 2 — Sub" },
  { value: 3, label: "Level 3 — Nested" },
];
