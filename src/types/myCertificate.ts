// src/types/myCertificate.ts

export type MyCertificateStatus =
  | 'valid'
  | 'expired'
  | 'pending';

export interface MyCertificate {
  id:                 string;
  certificateNumber:  string;
  certificateTitle:   string;
  courseName:         string;
  courseCode:         string;
  issueDate:          string;
  expiryDate:         string | null;
  certificateUrl:     string;
  qrCodeUrl:          string;
  status:             MyCertificateStatus;
}
