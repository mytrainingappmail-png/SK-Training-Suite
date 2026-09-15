// src/services/certificate/certificateViewService.ts
//
// Resolves everything needed to actually VIEW/DOWNLOAD one specific,
// already-issued certificate — the piece bulk-issue was missing.
// Real data only: the certificate row, its template (by template_name),
// the employee's real name, and the assessment title used as the
// course name (matching what bulk-issue itself used when filling the
// certificate text).

import { loadCertificates } from './certificateService';
import { loadTemplates } from '../certificateTemplate/certificateTemplateService';
import { loadAssessments } from '../assessment/assessmentService';
import { employeeService } from '../employee/employeeService';

import type { Certificate } from '../../types/certificate';
import type { CertificateTemplate } from '../../types/certificateTemplate';

export interface CertificateViewData {
  certificate: Certificate;
  template: CertificateTemplate;
  employeeName: string;
  courseName: string;
}

export async function loadCertificateForView(certificateId: string): Promise<CertificateViewData> {
  const map = await loadCertificatesForView([certificateId]);
  const data = map.get(certificateId);
  if (!data) throw new Error('Certificate not found.');
  return data;
}

/**
 * Same resolution as loadCertificateForView(), for many certificates at
 * once — fetches the four backing tables exactly ONCE regardless of how
 * many certificate ids are passed in. A grid of certificate cards used to
 * call loadCertificateForView() once per card, each independently
 * re-fetching all certificates/templates/assessments/employees just to
 * resolve its own single row.
 */
export async function loadCertificatesForView(certificateIds: string[]): Promise<Map<string, CertificateViewData>> {
  const result = new Map<string, CertificateViewData>();
  if (certificateIds.length === 0) return result;

  const [certificates, templates, assessments, employees] = await Promise.all([
    loadCertificates(),
    loadTemplates(),
    loadAssessments(),
    employeeService.getAll(),
  ]);

  const idSet = new Set(certificateIds);
  const defaultTemplate = templates.find((t) => t.default_template);

  for (const certificate of certificates) {
    if (!idSet.has(certificate.id)) continue;

    const template = templates.find((t) => t.template_name === certificate.template_name) ?? defaultTemplate;
    if (!template) continue;

    const employee = employees.find((e) => e.id === certificate.employee_id);
    const employeeName = employee ? `${employee.first_name} ${employee.last_name}`.trim() : 'Employee';

    const assessment = assessments.find((a) => a.id === certificate.assessment_id);
    const courseName = assessment?.assessment_title ?? '';

    result.set(certificate.id, { certificate, template, employeeName, courseName });
  }

  return result;
}
