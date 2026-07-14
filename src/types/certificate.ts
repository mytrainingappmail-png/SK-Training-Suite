export interface Certificate {

  id: string;

  assessment_result_id: string;

  employee_id: string;

  assessment_id: string;

  certificate_no: string;

  certificate_title: string;

  issue_date: string;

  expiry_date: string;

  certificate_url: string;

  qr_code_url: string;

  template_name: string;

  generated: boolean;

  published: boolean;

  active: boolean;

  remarks: string;

  created_at: string;

  updated_at: string;

}

export type CertificateForm = Omit<
  Certificate,
  "id" | "created_at" | "updated_at"
>;

export const defaultCertificateForm: CertificateForm = {
  assessment_result_id: "",
  employee_id:          "",
  assessment_id:        "",
  certificate_no:       "",
  certificate_title:    "",
  issue_date:           "",
  expiry_date:          "",
  certificate_url:      "",
  qr_code_url:          "",
  template_name:        "",
  generated:            false,
  published:            false,
  active:               true,
  remarks:              "",
};
