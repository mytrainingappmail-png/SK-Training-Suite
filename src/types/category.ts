export interface Category {

  id: string;

  company_id: string;

  category_code: string;

  category_name: string;

  description: string;

  active: boolean;

  created_at: string;

  updated_at: string;

}

export type CategoryForm = Omit<
  Category,
  "id" | "created_at" | "updated_at"
>;
