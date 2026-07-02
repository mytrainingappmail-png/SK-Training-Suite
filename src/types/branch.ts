export interface Branch {
  id: string;

  company_id: string;

  branch_code: string;

  branch_name: string;

  contact_person: string;

  address: string;

  city: string;

  state: string;

  country: string;

  pincode: string;

  phone: string;

  email: string;

  head_office: boolean;

  active: boolean;

  created_at: string;

  updated_at: string;
}

export type BranchForm = Omit<
  Branch,
  "id" | "created_at" | "updated_at"
>;