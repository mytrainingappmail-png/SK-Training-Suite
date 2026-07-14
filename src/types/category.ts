export interface Category {

  id: string;

  company_id: string;

  category_name: string;

  description: string;

  icon: string;

  display_order: number;

  active: boolean;

  created_at: string;

  updated_at: string;

}

export type CategoryForm = Omit<
  Category,
  "id" | "created_at" | "updated_at"
>;
