export type VerificationStatus =
  | "active"
  | "expired"
  | "revoked";

export interface CertificateVerification {

  id: string;

  certificate_id: string;

  verification_code: string;

  verification_url: string;

  qr_code_url: string;

  verification_status: VerificationStatus;

  verified_count: number;

  last_verified_at: string | null;

  expires_at: string | null;

  active: boolean;

  created_at: string;

  updated_at: string;

}

export type CertificateVerificationForm = Omit<
  CertificateVerification,
  "id" | "created_at" | "updated_at"
>;

export const defaultVerificationForm: CertificateVerificationForm = {
  certificate_id:      "",
  verification_code:   "",
  verification_url:    "",
  qr_code_url:         "",
  verification_status: "active",
  verified_count:      0,
  last_verified_at:    null,
  expires_at:          null,
  active:              true,
};
