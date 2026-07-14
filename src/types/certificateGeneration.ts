export type GenerationStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export interface CertificateGenerationQueueItem {

  id: string;

  assessment_result_id: string;

  certificate_id: string;

  template_id: string;

  employee_id: string;

  status: GenerationStatus;

  priority: number;

  retry_count: number;

  requested_at: string;

  started_at: string | null;

  completed_at: string | null;

  error_message: string;

  created_at: string;

  updated_at: string;

}

export type CertificateGenerationQueueForm = Omit<
  CertificateGenerationQueueItem,
  "id" | "created_at" | "updated_at"
>;

export const defaultQueueItemForm: CertificateGenerationQueueForm = {
  assessment_result_id: "",
  certificate_id:       "",
  template_id:          "",
  employee_id:          "",
  status:               "pending",
  priority:             1,
  retry_count:          0,
  requested_at:         "",
  started_at:           null,
  completed_at:         null,
  error_message:        "",
};
