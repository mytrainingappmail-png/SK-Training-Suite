export interface Company {
  id: string;

  company_code: string;

  company_name: string;

  short_name: string;

  legal_name: string;

  website: string;

  email: string;

  phone: string;

  logo: string;

  favicon: string;

  address: string;

  city: string;

  state: string;

  country: string;

  pincode: string;

  gst_number: string;

  pan_number: string;

  timezone: string;

  currency: string;

  language: string;

  theme: string;

  active: boolean;

  created_at: string;

  updated_at: string;
}

export type CompanyForm = Omit<
  Company,
  "id" | "created_at" | "updated_at"
>;