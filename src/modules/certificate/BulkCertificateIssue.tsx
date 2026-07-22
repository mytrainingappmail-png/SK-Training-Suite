// src/modules/certificate/BulkCertificateIssue.tsx
//
// Bulk Certificate Issue — pick an Assessment, check which genuinely-
// passed employees to issue a certificate to, pick a Template, edit a
// subject line, submit. Names are auto-filled from real employee data,
// never typed manually. Not yet wired into sidebar/routes — standalone
// module.

import { useEffect, useState } from 'react';
import { loadAssessments } from '../../services/assessment/assessmentService';
import {
  loadEligibleEmployeesForAssessment,
  loadCertificateTemplatesForIssue,
  bulkIssueCertificates,
} from '../../services/certificate/bulkCertificateService';
import type { Assessment } from '../../types/assessment';
import type { EligibleEmployee } from '../../services/certificate/bulkCertificateService';
import type { CertificateTemplate } from '../../types/certificateTemplate';

function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}
function IconSend({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.126A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.876L5.999 12Zm0 0h7.5" /></svg>);
}

function PrimaryButton({ onClick, disabled, children }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (<button type="button" onClick={onClick} disabled={disabled} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]">{children}</button>);
}
function SecondaryButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (<button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/70 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>{children}</button>);
}
const INPUT_CLS = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
      <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
      <p className="font-medium">{message}</p>
    </div>
  );
}

function BulkCertificateIssue() {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [eligible, setEligible] = useState<EligibleEmployee[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [subjectLine, setSubjectLine] = useState('Congratulations on completing your certification!');

  const [issuing, setIssuing] = useState(false);
  const [summary, setSummary] = useState('');
  const [toast, setToast] = useState('');

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  }

  useEffect(() => {
    setLoadingInitial(true);
    Promise.all([loadAssessments(), loadCertificateTemplatesForIssue()])
      .then(([assessmentRows, templateRows]) => {
        setAssessments(assessmentRows);
        setTemplates(templateRows);
        const defaultTemplate = templateRows.find((t) => t.default_template);
        if (defaultTemplate) setSelectedTemplateId(defaultTemplate.id);
      })
      .catch((err: unknown) => showToast(err instanceof Error ? err.message : 'Failed to load data.'))
      .finally(() => setLoadingInitial(false));
  }, []);

  function handleSelectAssessment(assessmentId: string) {
    setSelectedAssessmentId(assessmentId);
    setEligible([]);
    setCheckedIds(new Set());
    setSummary('');
    if (!assessmentId) return;

    setLoadingEligible(true);
    loadEligibleEmployeesForAssessment(assessmentId)
      .then((rows) => {
        setEligible(rows);
        setCheckedIds(new Set(rows.filter((r) => !r.alreadyIssued).map((r) => r.employeeId)));
      })
      .catch((err: unknown) => showToast(err instanceof Error ? err.message : 'Failed to load eligible employees.'))
      .finally(() => setLoadingEligible(false));
  }

  function toggleEmployee(employeeId: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(employeeId)) next.delete(employeeId);
      else next.add(employeeId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (checkedIds.size === eligible.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(eligible.map((e) => e.employeeId)));
    }
  }

  async function handleIssue() {
    const template = templates.find((t) => t.id === selectedTemplateId);
    const assessment = assessments.find((a) => a.id === selectedAssessmentId);
    if (!template || !assessment) {
      showToast('Select an assessment and a template first.');
      return;
    }
    if (checkedIds.size === 0) {
      showToast('Select at least one employee.');
      return;
    }

    setIssuing(true);
    setSummary('');
    try {
      const result = await bulkIssueCertificates({
        assessmentId: selectedAssessmentId,
        courseName: assessment.assessment_title,
        eligibleEmployees: eligible,
        selectedEmployeeIds: Array.from(checkedIds),
        template,
      });
      setSummary(`Issued ${result.issued} certificate(s). ${result.failed > 0 ? `${result.failed} failed.` : ''}`);
      if (result.errors.length > 0) showToast('Some certificates failed — see summary for details.');
      else showToast('Certificates issued');
      handleSelectAssessment(selectedAssessmentId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to issue certificates.');
    } finally {
      setIssuing(false);
    }
  }

  if (loadingInitial) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900">Bulk Certificate Issue</h2>
        <p className="text-sm text-slate-500">Pick an assessment, choose who passed to certify, and issue certificates in one go.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 rounded-2xl bg-white p-4 shadow-sm sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Assessment</label>
          <select value={selectedAssessmentId} onChange={(e) => handleSelectAssessment(e.target.value)} className={INPUT_CLS}>
            <option value="">Select an assessment…</option>
            {assessments.map((a) => (<option key={a.id} value={a.id}>{a.assessment_title}</option>))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500">Certificate Template</label>
          <select value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)} className={INPUT_CLS}>
            <option value="">Select a template…</option>
            {templates.map((t) => (<option key={t.id} value={t.id}>{t.template_name}</option>))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-semibold text-slate-500">Email Subject Line</label>
          <input value={subjectLine} onChange={(e) => setSubjectLine(e.target.value)} className={INPUT_CLS} />
          <p className="mt-1 text-xs text-slate-400">Used if/when certificate email delivery is configured — see License Notifications setup.</p>
        </div>
      </div>

      {selectedAssessmentId && (
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Eligible Employees (Passed)</h3>
            {eligible.length > 0 && (
              <SecondaryButton onClick={toggleSelectAll}>
                {checkedIds.size === eligible.length ? 'Deselect All' : 'Select All'}
              </SecondaryButton>
            )}
          </div>

          {loadingEligible ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</div>
          ) : eligible.length === 0 ? (
            <EmptyState message="No employees have passed this assessment yet." />
          ) : (
            <div className="divide-y divide-slate-100">
              {eligible.map((emp) => (
                <label key={emp.employeeId} className="flex cursor-pointer items-center gap-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={checkedIds.has(emp.employeeId)}
                    onChange={() => toggleEmployee(emp.employeeId)}
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-400"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">{emp.employeeName} <span className="font-mono text-xs text-slate-400">{emp.employeeCode}</span></p>
                    <p className="text-xs text-slate-400">{emp.percentage}% · Grade {emp.grade}</p>
                  </div>
                  {emp.alreadyIssued && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Already Issued</span>
                  )}
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {summary && (
        <div className="rounded-2xl bg-indigo-50 p-4 text-sm text-indigo-700">{summary}</div>
      )}

      <div className="flex justify-end">
        <PrimaryButton onClick={handleIssue} disabled={issuing || !selectedAssessmentId || !selectedTemplateId || checkedIds.size === 0}>
          {issuing ? <IconSpinner className="h-3.5 w-3.5" /> : <IconSend className="h-4 w-4" />} Issue {checkedIds.size > 0 ? `${checkedIds.size} ` : ''}Certificate{checkedIds.size === 1 ? '' : 's'}
        </PrimaryButton>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default BulkCertificateIssue;
