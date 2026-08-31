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

export type DesignPreset =
  | "classic_gold"
  | "modern_navy"
  | "elegant_emerald"
  | "minimal_slate"
  | "royal_maroon"
  | "corporate_blue"
  | "vibrant_sunset"
  | "ocean_teal"
  | "festive_purple";

export type LogoPosition =
  | "top_center"
  | "top_left"
  | "top_right";

/** Same "Picture watermark or Text watermark" choice Word's own watermark dialog offers — independent of logo_position, so a design can have both a positioned logo and a faded background mark at once. "none" draws neither. */
export type WatermarkType = "none" | "logo" | "text";

/** Purely cosmetic crop shape for the employee photo slot. */
export type PhotoFrame = "circle" | "square" | "rounded_square" | "hexagon" | "oval" | "polaroid";

export interface CertificateTemplate {

  id: string;

  template_name: string;

  template_code: string;

  description: string;

  background_image_url: string;

  logo_url: string;

  logo_position: LogoPosition;

  /** Independent of logo_position — an optional full-page background watermark, either the logo image faded out or custom diagonal text. */
  watermark_type: WatermarkType;

  /** Only used when watermark_type is "text". */
  watermark_text: string;

  /** Reserves a spot on the layout for the employee's photo — the image itself is attached per-certificate by an admin after issuance, never self-uploaded. */
  photo_enabled: boolean;

  /** Crop shape for that photo slot — cosmetic only. */
  photo_frame: PhotoFrame;

  signature_url: string;

  signatory_1_name: string;

  signatory_1_title: string;

  signature_2_url: string;

  signatory_2_name: string;

  signatory_2_title: string;

  // The big heading, e.g. "CERTIFICATE OF ACHIEVEMENT"
  certificate_title: string;

  // Small line above or below the title, e.g. "This certificate is proudly presented to"
  subtitle_text: string;

  // Paragraph shown below the employee's name. Supports placeholders:
  // {{employee_name}}, {{course_name}}, {{issue_date}}, {{certificate_no}}
  description_text: string;

  description_bold: boolean;

  description_color: string;

  design_preset: DesignPreset;

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

export const DEFAULT_SUBTITLE_TEXT = "This certificate is proudly presented to";

export const DEFAULT_DESCRIPTION_TEXT =
  "for successfully completing {{course_name}} on {{issue_date}}.";

export const defaultCertificateTemplateForm: CertificateTemplateForm = {
  template_name:        "",
  template_code:        "",
  description:          "",
  background_image_url: "",
  logo_url:             "",
  logo_position:        "top_center",
  watermark_type:       "none",
  watermark_text:       "",
  photo_enabled:        false,
  photo_frame:          "circle",
  signature_url:        "",
  signatory_1_name:     "",
  signatory_1_title:    "",
  signature_2_url:      "",
  signatory_2_name:     "",
  signatory_2_title:    "",
  certificate_title:    "CERTIFICATE OF ACHIEVEMENT",
  subtitle_text:        DEFAULT_SUBTITLE_TEXT,
  description_text:     DEFAULT_DESCRIPTION_TEXT,
  description_bold:     false,
  description_color:    "#3F3F3F",
  design_preset:        "classic_gold",
  qr_position:          "bottom_right",
  orientation:          "landscape",
  paper_size:           "A4",
  font_family:          "Arial",
  font_size:            14,
  active:               true,
  default_template:     false,
};

export const DESIGN_PRESETS: { value: DesignPreset; label: string }[] = [
  { value: "classic_gold",     label: "Classic Gold"     },
  { value: "modern_navy",      label: "Modern Navy"      },
  { value: "elegant_emerald",  label: "Elegant Emerald"  },
  { value: "minimal_slate",    label: "Minimal Slate"    },
  { value: "royal_maroon",     label: "Royal Maroon"     },
  { value: "corporate_blue",   label: "Corporate Blue"   },
  { value: "vibrant_sunset",   label: "Vibrant Sunset"   },
  { value: "ocean_teal",       label: "Ocean Teal"       },
  { value: "festive_purple",   label: "Festive Purple"   },
];

export const LOGO_POSITIONS: { value: LogoPosition; label: string }[] = [
  { value: "top_center",       label: "Top Center"      },
  { value: "top_left",         label: "Top Left"        },
  { value: "top_right",        label: "Top Right"       },
];

export const WATERMARK_TYPES: { value: WatermarkType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "logo", label: "🖼 Logo as Watermark" },
  { value: "text", label: "🔤 Custom Text" },
];

export const PHOTO_FRAMES: { value: PhotoFrame; label: string }[] = [
  { value: "circle",         label: "◯ Circle"  },
  { value: "square",         label: "◻ Square"  },
  { value: "rounded_square", label: "▢ Rounded" },
  { value: "hexagon",        label: "⬡ Hexagon" },
  { value: "oval",           label: "⬭ Oval"    },
  { value: "polaroid",       label: "🖼 Polaroid" },
];

export function fillCertificateText(
  bodyText: string,
  values: { employeeName: string; courseName: string; issueDate: string; certificateNo: string }
): string {
  return bodyText
    .replace(/\{\{employee_name\}\}/g, values.employeeName)
    .replace(/\{\{course_name\}\}/g, values.courseName)
    .replace(/\{\{issue_date\}\}/g, values.issueDate)
    .replace(/\{\{certificate_no\}\}/g, values.certificateNo);
}
