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
  const [certificates, templates, assessments, employees] = await Promise.all([
    loadCertificates(),
    loadTemplates(),
    loadAssessments(),
    employeeService.getAll(),
  ]);

  const certificate = certificates.find((c) => c.id === certificateId);
  if (!certificate) throw new Error('Certificate not found.');

  const template =
    templates.find((t) => t.template_name === certificate.template_name) ??
    templates.find((t) => t.default_template);
  if (!template) throw new Error('Certificate template not found.');

  const employee = employees.find((e) => e.id === certificate.employee_id);
  const employeeName = employee ? `${employee.first_name} ${employee.last_name}`.trim() : 'Employee';

  const assessment = assessments.find((a) => a.id === certificate.assessment_id);
  const courseName = assessment?.assessment_title ?? '';

  return { certificate, template, employeeName, courseName };
}
