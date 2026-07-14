// src/services/myCertificate/myCertificateService.ts
// Business logic only — no Supabase imports.

import { getMyCertificates } from '../../repositories/myCertificate/myCertificateRepository';
import type { MyCertificate } from '../../types/myCertificate';

export async function loadMyCertificates(employeeId: string): Promise<MyCertificate[]> {
  if (!employeeId) throw new Error('Employee ID is required.');
  return await getMyCertificates(employeeId);
}
