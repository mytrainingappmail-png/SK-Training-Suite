export type QrPosition =
  | "top_left"
  | "top_right"
  | "bottom_left"
  | "bottom_right"
  | "center";

export type Orientation =
  | "landscape"
  | "portrait";

export type PaperSize =
  | "A4"
  | "A3"
  | "Letter"
  | "Legal";

export interface CertificateTemplate {

  id: string;

  template_name: string;

  template_code: string;

  description: string;

  background_image_url: string;

  logo_url: string;

  signature_url: string;

  qr_position: QrPosition;

  orientation: Orientation;

  paper_size: PaperSize;

  font_family: string;

  font_size: number;

  active: boolean;

  default_template: boolean;

  created_at: string;

  updated_at: string;

}

export type CertificateTemplateForm = Omit<
  CertificateTemplate,
  "id" | "created_at" | "updated_at"
>;

export const defaultCertificateTemplateForm: CertificateTemplateForm = {
  template_name:        "",
  template_code:        "",
  description:          "",
  background_image_url: "",
  logo_url:             "",
  signature_url:        "",
  qr_position:          "bottom_right",
  orientation:          "landscape",
  paper_size:           "A4",
  font_family:          "Arial",
  font_size:            14,
  active:               true,
  default_template:     false,
};
