// src/services/certificate/bulkCertificateService.ts
//
// Bulk Certificate Issue — real business logic only. Delegates all
// Supabase access to the existing, unmodified assessmentResultService,
// employeeService, certificateService, and certificateTemplateService.
// Never fabricates pass/fail status — only genuinely passed, real
// assessment results are eligible.

import { loadResults, saveResult } from '../assessmentResult/assessmentResultService';
import { employeeService } from '../employee/employeeService';
import { createCertificate } from '../certificate/certificateService';
import { loadTemplates } from '../certificateTemplate/certificateTemplateService';

import type { AssessmentResult } from '../../types/assessmentResult';
import type { CertificateTemplate } from '../../types/certificateTemplate';
import { fillCertificateText } from '../../types/certificateTemplate';

export interface EligibleEmployee {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  assessmentResultId: string;
  percentage: number;
  grade: string;
  alreadyIssued: boolean;
  rawResult: AssessmentResult;
}

/**
 * Every employee who genuinely PASSED the given assessment — real data
 * only, never simulated. alreadyIssued flags results that already have
 * a certificate, so the UI can show (and default-uncheck) them instead
 * of hiding them outright.
 */
export async function loadEligibleEmployeesForAssessment(assessmentId: string): Promise<EligibleEmployee[]> {
  const [results, employees] = await Promise.all([loadResults(), employeeService.getAll()]);
  const employeeById = new Map(employees.map((e) => [e.id, e]));

  const passedResults = results.filter((r) => r.assessment_id === assessmentId && r.passed);

  // An employee may have multiple passing attempts for the same
  // assessment — keep only their most recent one so they appear once,
  // not once per attempt.
  const latestByEmployee = new Map<string, AssessmentResult>();
  for (const r of passedResults) {
    const existing = latestByEmployee.get(r.employee_id);
    if (!existing || new Date(r.evaluated_at).getTime() > new Date(existing.evaluated_at).getTime()) {
      latestByEmployee.set(r.employee_id, r);
    }
  }

  return Array.from(latestByEmployee.values()).map((r) => {
    const employee = employeeById.get(r.employee_id);
    return {
      employeeId: r.employee_id,
      employeeName: employee ? `${employee.first_name} ${employee.last_name}`.trim() : 'Unknown Employee',
      employeeCode: employee?.employee_code ?? '',
      assessmentResultId: r.id,
      percentage: r.percentage,
      grade: r.grade,
      alreadyIssued: r.certificate_generated,
      rawResult: r,
    };
  });
}

export async function loadCertificateTemplatesForIssue(): Promise<CertificateTemplate[]> {
  const templates = await loadTemplates();
  return templates.filter((t) => t.active);
}

function generateCertificateNo(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(100000 + Math.random() * 900000);
  return `CERT-${year}-${random}`;
}

export interface BulkIssueParams {
  assessmentId: string;
  courseName: string;
  eligibleEmployees: EligibleEmployee[];
  selectedEmployeeIds: string[];
  template: CertificateTemplate;
}

export interface BulkIssueResult {
  issued: number;
  failed: number;
  errors: string[];
}

/**
 * Issues real Certificate rows for every selected, genuinely-passed
 * employee, filling in their name via the template's own text
 * placeholders, and marks the underlying assessment result as
 * certificate_generated so the same employee is never double-issued
 * a certificate for the same result by accident.
 */
export async function bulkIssueCertificates(params: BulkIssueParams): Promise<BulkIssueResult> {
  const result: BulkIssueResult = { issued: 0, failed: 0, errors: [] };
  const selectedSet = new Set(params.selectedEmployeeIds);
  const issueDate = new Date().toISOString().slice(0, 10);

  for (const eligible of params.eligibleEmployees) {
    if (!selectedSet.has(eligible.employeeId)) continue;

    try {
      const filledTitle = fillCertificateText(params.template.certificate_title, {
        employeeName: eligible.employeeName,
        courseName: params.courseName,
        issueDate,
        certificateNo: '',
      });

      await createCertificate({
        assessment_result_id: eligible.assessmentResultId,
        employee_id: eligible.employeeId,
        assessment_id: params.assessmentId,
        certificate_no: generateCertificateNo(),
        certificate_title: filledTitle,
        issue_date: issueDate,
        expiry_date: null as unknown as string,
        certificate_url: '',
        qr_code_url: '',
        template_name: params.template.template_name,
        generated: true,
        published: true,
        active: true,
        remarks: '',
      });

      await saveResult(eligible.assessmentResultId, {
        attempt_id: eligible.rawResult.attempt_id,
        assessment_id: eligible.rawResult.assessment_id,
        employee_id: eligible.rawResult.employee_id,
        total_marks: eligible.rawResult.total_marks,
        obtained_marks: eligible.rawResult.obtained_marks,
        percentage: eligible.rawResult.percentage,
        passed: eligible.rawResult.passed,
        grade: eligible.rawResult.grade,
        rank: eligible.rawResult.rank,
        certificate_generated: true,
        evaluated_at: eligible.rawResult.evaluated_at,
        published: eligible.rawResult.published,
        remarks: eligible.rawResult.remarks,
      });
      result.issued += 1;
    } catch (err) {
      result.failed += 1;
      result.errors.push(`${eligible.employeeName}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  return result;
}