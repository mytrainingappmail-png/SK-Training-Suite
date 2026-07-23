// src/components/admin/email/EmailTemplateBuilder.tsx
//
// Professional Email Template Builder. Templates persist to the real
// email_templates table (company-scoped by RLS to the signed-in admin's
// own company) via src/services/email/emailTemplateService.ts. Local
// component state stays the in-progress editing buffer — DB writes only
// happen at explicit save points (Create, Duplicate, Delete, Save Draft,
// Publish, Archive) so a network round-trip never fires per keystroke.
// "Send Test Email" compiles the live (possibly-unsaved) draft and sends
// it for real via the send-email Edge Function (Resend).
//
// Everything else here is reused as-is:
//   companyService (loadCompanies)   — company selector; a company's
//                                      REAL, existing `theme` JSON blob
//                                      (already written by
//                                      BrandingManagement.tsx) is read
//                                      read-only to pre-fill sensible
//                                      branding defaults (logo, colors) —
//                                      never written back here, so it can
//                                      never collide with that file.
//   employeeService (getAll)        — real recipient for Send Test Email
//                                      and real data for variable preview
//   courseService, assessmentService, lessonBuilderService,
//   learningPathService, certificateService — real records used to
//                                      populate the live variable preview
//   session.getCurrentUser()        — stamps who created each template
//
// The Rich HTML Editor reuses the same native execCommand technique
// already used throughout this app's editors (ContentEditor.tsx) rather
// than a new library — no new dependency.
//
// No repository, service, or database changes.

import { useEffect, useRef, useState } from 'react';
import { loadCompanies } from '../../../services/company/companyService';
import { employeeService } from '../../../services/employee/employeeService';
import { loadCourses } from '../../../services/course/courseService';
import { loadAssessments } from '../../../services/assessment/assessmentService';
import { loadLessons } from '../../../services/lessonBuilder/lessonBuilderService';
import { loadLearningPaths } from '../../../services/learningPath/learningPathService';
import { loadCertificates } from '../../../services/certificate/certificateService';
import { getCurrentUser } from '../../../services/auth/session';
import * as emailTemplateService from '../../../services/email/emailTemplateService';

import type { Company } from '../../../types/company';
import type { EmailTemplate as DbEmailTemplate, EmailTemplateForm as DbEmailTemplateForm } from '../../../types/emailTemplate';
import type { Employee } from '../../../types/employee';
import type { Course } from '../../../types/course';
import type { Assessment } from '../../../types/assessment';
import type { Lesson } from '../../../types/lessonBuilder';
import type { LearningPath } from '../../../types/learningPath';
import type { Certificate } from '../../../types/certificate';

// ─────────────────────────────────────────────────────────────────────────────
// Email template domain — session-local only, no backend exists for this yet
// ─────────────────────────────────────────────────────────────────────────────

type TemplateType =
  | 'welcome' | 'course_assigned' | 'course_completed' | 'assessment_assigned' | 'assessment_reminder'
  | 'assessment_result' | 'assignment_assigned' | 'assignment_reminder' | 'assignment_submitted'
  | 'certificate_issued' | 'learning_path_assigned' | 'password_reset' | 'subscription_reminder'
  | 'license_expiry' | 'general_announcement';

const TEMPLATE_TYPES: { value: TemplateType; label: string }[] = [
  { value: 'welcome',                label: 'Welcome' },
  { value: 'course_assigned',        label: 'Course Assigned' },
  { value: 'course_completed',       label: 'Course Completed' },
  { value: 'assessment_assigned',    label: 'Assessment Assigned' },
  { value: 'assessment_reminder',    label: 'Assessment Reminder' },
  { value: 'assessment_result',      label: 'Assessment Result' },
  { value: 'assignment_assigned',    label: 'Assignment Assigned' },
  { value: 'assignment_reminder',    label: 'Assignment Reminder' },
  { value: 'assignment_submitted',   label: 'Assignment Submitted' },
  { value: 'certificate_issued',     label: 'Certificate Issued' },
  { value: 'learning_path_assigned', label: 'Learning Path Assigned' },
  { value: 'password_reset',         label: 'Password Reset' },
  { value: 'subscription_reminder',  label: 'Subscription Reminder' },
  { value: 'license_expiry',         label: 'License Expiry' },
  { value: 'general_announcement',   label: 'General Announcement' },
];
const TYPE_LABEL: Record<TemplateType, string> = Object.fromEntries(TEMPLATE_TYPES.map((t) => [t.value, t.label])) as Record<TemplateType, string>;

type TemplateStatus = 'draft' | 'published' | 'archived';
const STATUS_LABEL: Record<TemplateStatus, string> = { draft: 'Draft', published: 'Published', archived: 'Archived' };
const STATUS_STYLES: Record<TemplateStatus, string> = {
  draft:     'bg-slate-100 text-slate-500 ring-1 ring-slate-200',
  published: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  archived:  'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
};

const VARIABLES = [
  '{{employee_name}}', '{{company_name}}', '{{course_name}}', '{{assessment_name}}',
  '{{assignment_name}}', '{{certificate_name}}', '{{trainer_name}}', '{{completion_percentage}}',
  '{{login_url}}', '{{support_email}}',
];

interface TemplateBranding {
  logoUrl:        string;
  headerText:     string;
  footerText:     string;
  primaryColor:   string;
  secondaryColor: string;
  buttonColor:    string;
}

const DEFAULT_BRANDING: TemplateBranding = {
  logoUrl: '',
  headerText: '',
  footerText: 'You are receiving this email because you are enrolled in a training program.',
  primaryColor: '#4f46e5',
  secondaryColor: '#0f172a',
  buttonColor: '#f97316',
};

interface EmailTemplate {
  id:           string;
  name:         string;
  subject:      string;
  category:     TemplateType;
  bodyHtml:     string;
  status:       TemplateStatus;
  companyId:    string;
  branding:     TemplateBranding;
  createdBy:    string;
  createdDate:  string;
  modifiedDate: string;
}

function newTemplate(actorName: string, companyId: string, branding: TemplateBranding): EmailTemplate {
  const now = new Date().toISOString();
  return {
    id: `tmpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name: 'Untitled Template',
    subject: '',
    category: 'general_announcement',
    bodyHtml: '<p>Hi {{employee_name}},</p><p>Write your message here.</p>',
    status: 'draft',
    companyId,
    branding: { ...branding },
    createdBy: actorName,
    createdDate: now,
    modifiedDate: now,
  };
}

function parseThemeBlob(theme: string): Record<string, unknown> {
  if (!theme) return {};
  try {
    const parsed = JSON.parse(theme);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function brandingDefaultsFromCompany(company: Company | null): TemplateBranding {
  if (!company) return { ...DEFAULT_BRANDING };
  const blob = parseThemeBlob(company.theme);
  return {
    logoUrl: company.logo || (typeof blob.lightLogoUrl === 'string' ? blob.lightLogoUrl : ''),
    headerText: company.company_name,
    footerText: DEFAULT_BRANDING.footerText,
    primaryColor: typeof blob.primaryColor === 'string' ? blob.primaryColor : DEFAULT_BRANDING.primaryColor,
    secondaryColor: typeof blob.secondaryColor === 'string' ? blob.secondaryColor : DEFAULT_BRANDING.secondaryColor,
    buttonColor: typeof blob.accentColor === 'string' ? blob.accentColor : DEFAULT_BRANDING.buttonColor,
  };
}

// ── DB row <-> local editor shape ────────────────────────────────────────────
// The email_templates table is company-scoped by RLS to the signed-in
// admin's own company_id, regardless of which company is selected in the
// "Branding Company" picker above (that picker only prefills branding
// defaults from any company's theme — it never changes which company a
// template is saved under).

function dbRowToLocal(row: DbEmailTemplate): EmailTemplate {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    category: row.category as TemplateType,
    bodyHtml: row.body_html,
    status: row.status,
    companyId: row.company_id,
    branding: { ...DEFAULT_BRANDING, ...(row.branding as Partial<TemplateBranding>) },
    createdBy: row.created_by_name,
    createdDate: row.created_at,
    modifiedDate: row.updated_at,
  };
}

function localToDbForm(local: EmailTemplate): DbEmailTemplateForm {
  return {
    name: local.name,
    category: local.category,
    subject: local.subject,
    body_html: local.bodyHtml,
    status: local.status,
    branding: local.branding,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Icons + shared UI primitives
// ─────────────────────────────────────────────────────────────────────────────

function IconPlus({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}
function IconTrash({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166M4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  );
}
function IconDuplicate({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.29 48.29 0 0 1 1.927-.184" />
    </svg>
  );
}
function IconEye({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}
function IconX({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  );
}
function IconDesktop({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
    </svg>
  );
}
function IconMobile({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
    </svg>
  );
}

function PrimaryButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}
function AccentButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}
function SecondaryButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200/70 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}
function DangerButton({ onClick, disabled, children, className = '' }: { onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-red-100 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] ${className}`}>
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-500">{label}</label>
      {children}
    </div>
  );
}
const INPUT_CLS = 'w-full rounded-lg bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/40';

function StatusBadge({ status }: { status: TemplateStatus }) {
  return <span className={`inline-flex flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>{STATUS_LABEL[status]}</span>;
}

function Skeleton() {
  return (
    <div className="space-y-6">
      <div className="h-14 animate-pulse rounded-2xl bg-slate-100" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load data</p>
      <p className="mt-1">{message}</p>
      <SecondaryButton onClick={onRetry} className="mt-4">Try Again</SecondaryButton>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-16 text-center text-slate-400">
      <svg className="h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
      </svg>
      <p className="font-medium">{message}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rich HTML Editor — same native execCommand technique used throughout
// this app's editors (no new library)
// ─────────────────────────────────────────────────────────────────────────────

function RichHtmlEditor({ html, onChange }: { html: string; onChange: (html: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const savedRangeRef = useRef<Range | null>(null);

  useEffect(() => {
    if (editorRef.current && !initializedRef.current) {
      editorRef.current.innerHTML = html;
      initializedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }

  function restoreSelection() {
    if (!savedRangeRef.current) return;
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(savedRangeRef.current);
  }

  function emitChange() {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  function exec(command: string, value?: string) {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(command, false, value);
    saveSelection();
    emitChange();
  }

  function insertHtml(text: string) {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand('insertHTML', false, text);
    saveSelection();
    emitChange();
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1 rounded-xl bg-slate-50 p-1.5">
        <button onMouseDown={(e) => { e.preventDefault(); exec('bold'); }} className="rounded-lg px-2.5 py-1.5 text-sm font-bold text-slate-600 hover:bg-white hover:shadow-sm">B</button>
        <button onMouseDown={(e) => { e.preventDefault(); exec('italic'); }} className="rounded-lg px-2.5 py-1.5 text-sm italic text-slate-600 hover:bg-white hover:shadow-sm">I</button>
        <button onMouseDown={(e) => { e.preventDefault(); exec('underline'); }} className="rounded-lg px-2.5 py-1.5 text-sm underline text-slate-600 hover:bg-white hover:shadow-sm">U</button>
        <span className="mx-1 h-6 w-px bg-slate-200" />
        <select onMouseDown={(e) => e.stopPropagation()} onChange={(e) => exec('formatBlock', e.target.value)} defaultValue="<p>" className="h-8 rounded-lg bg-white px-2 text-xs text-slate-700 shadow-sm">
          <option value="<p>">Text</option>
          <option value="<h1>">Heading 1</option>
          <option value="<h2>">Heading 2</option>
          <option value="<h3>">Heading 3</option>
        </select>
        <span className="mx-1 h-6 w-px bg-slate-200" />
        <button onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }} className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-white hover:shadow-sm">• List</button>
        <button onMouseDown={(e) => { e.preventDefault(); exec('justifyCenter'); }} className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-white hover:shadow-sm">Center</button>
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            const url = window.prompt('Button/Link URL:', 'https://');
            if (url) insertHtml(`<a href="${url}" style="color:#4f46e5;text-decoration:underline;">${url}</a>`);
          }}
          className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-white hover:shadow-sm"
        >
          Link
        </button>
        <span className="mx-1 h-6 w-px bg-slate-200" />
        <select
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => { if (e.target.value) { insertHtml(e.target.value); e.target.value = ''; } }}
          defaultValue=""
          className="h-8 rounded-lg bg-white px-2 text-xs text-slate-700 shadow-sm"
        >
          <option value="">Insert Variable…</option>
          {VARIABLES.map((v) => (<option key={v} value={v}>{v}</option>))}
        </select>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        className="prose prose-slate min-h-[220px] max-w-none rounded-xl bg-slate-50 p-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Preview renderer — compiled HTML with variable substitution
// ─────────────────────────────────────────────────────────────────────────────

function compileHtml(html: string, values: Record<string, string>): string {
  let out = html;
  Object.entries(values).forEach(([token, value]) => {
    out = out.split(token).join(value || token);
  });
  return out;
}

function EmailPreview({
  template, values, mode,
}: { template: EmailTemplate; values: Record<string, string>; mode: 'desktop' | 'mobile' }) {
  const width = mode === 'desktop' ? 'max-w-xl' : 'max-w-[320px]';
  return (
    <div className={`mx-auto overflow-hidden rounded-xl border border-slate-100 ${width}`}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ backgroundColor: template.branding.primaryColor }}>
        {template.branding.logoUrl ? (
          <img src={template.branding.logoUrl} alt="" className="h-6 object-contain" />
        ) : (
          <span className="text-sm font-bold text-white">{template.branding.headerText || 'Company'}</span>
        )}
      </div>
      <div className="bg-white p-5">
        <p className="mb-3 text-sm font-semibold text-slate-800">{compileHtml(template.subject, values) || 'Subject line'}</p>
        <div className="prose prose-sm max-w-none text-slate-700" dangerouslySetInnerHTML={{ __html: compileHtml(template.bodyHtml, values) }} />
        <div className="mt-4">
          <span className="inline-block rounded-lg px-4 py-2 text-xs font-semibold text-white" style={{ backgroundColor: template.branding.buttonColor }}>
            Take Action
          </span>
        </div>
      </div>
      <div className="px-4 py-3 text-center text-[11px] text-slate-400" style={{ backgroundColor: template.branding.secondaryColor + '10' }}>
        {template.branding.footerText}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main EmailTemplateBuilder
// ─────────────────────────────────────────────────────────────────────────────

function EmailTemplateBuilder() {
  const user = getCurrentUser();
  const actorName = user ? `${user.firstName} ${user.lastName}`.trim() : 'System';

  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [activeTemplateId, setActiveTemplateId] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | TemplateType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TemplateStatus>('all');

  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [testEmployeeId, setTestEmployeeId] = useState('');

  const [previewCourseId, setPreviewCourseId] = useState('');
  const [previewAssessmentId, setPreviewAssessmentId] = useState('');
  const [previewLessonId, setPreviewLessonId] = useState('');
  const [previewCertificateId, setPreviewCertificateId] = useState('');
  const [previewPathId, setPreviewPathId] = useState('');
  const [previewEmployeeId, setPreviewEmployeeId] = useState('');

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2400);
  }

  function fetchAll() {
    setLoading(true);
    setError('');
    Promise.all([
      loadCompanies(), employeeService.getAll(), loadCourses(), loadAssessments(), loadLessons(), loadLearningPaths(), loadCertificates(),
      emailTemplateService.loadTemplates(user?.companyId ?? ''),
    ])
      .then(([companyRows, employeeRows, courseRows, assessmentRows, lessonRows, pathRows, certificateRows, templateRows]) => {
        setCompanies(companyRows);
        setEmployees(employeeRows);
        setCourses(courseRows);
        setAssessments(assessmentRows);
        setLessons(lessonRows);
        setLearningPaths(pathRows);
        setCertificates(certificateRows);
        setTemplates(templateRows.map(dbRowToLocal));
        setSelectedCompanyId((prev) => prev || companyRows[0]?.id || '');
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load data.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId) ?? null;
  const activeTemplate = templates.find((t) => t.id === activeTemplateId) ?? null;

  // ── Template CRUD ────────────────────────────────────────────────────────────

  async function handleCreate() {
    if (!user) return;
    const branding = brandingDefaultsFromCompany(selectedCompany);
    const draft = newTemplate(actorName, user.companyId, branding);
    try {
      const dbRow = await emailTemplateService.createTemplate(user.companyId, user.id, actorName, localToDbForm(draft));
      const created = dbRowToLocal(dbRow);
      setTemplates((prev) => [created, ...prev]);
      setActiveTemplateId(created.id);
      showToast('Template created');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create template.');
    }
  }

  async function handleDuplicate(t: EmailTemplate) {
    if (!user) return;
    try {
      const dbRow = await emailTemplateService.createTemplate(user.companyId, user.id, actorName, {
        name: `${t.name} (Copy)`,
        category: t.category,
        subject: t.subject,
        body_html: t.bodyHtml,
        status: 'draft',
        branding: t.branding,
      });
      const copy = dbRowToLocal(dbRow);
      setTemplates((prev) => [copy, ...prev]);
      setActiveTemplateId(copy.id);
      showToast('Template duplicated');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to duplicate template.');
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await emailTemplateService.deleteTemplate(deleteTarget.id);
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
      if (activeTemplateId === deleteTarget.id) setActiveTemplateId('');
      showToast('Template deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete template.');
    } finally {
      setDeleteTarget(null);
    }
  }

  // Local-only — fires on every keystroke, so no DB call here. Persistence
  // happens at explicit save points (setStatus below, plus create/duplicate/delete).
  function updateActiveTemplate(patch: Partial<EmailTemplate>) {
    if (!activeTemplateId) return;
    setTemplates((prev) => prev.map((t) => (t.id === activeTemplateId ? { ...t, ...patch, modifiedDate: new Date().toISOString() } : t)));
  }

  function updateActiveBranding(patch: Partial<TemplateBranding>) {
    if (!activeTemplate) return;
    updateActiveTemplate({ branding: { ...activeTemplate.branding, ...patch } });
  }

  async function setStatus(status: TemplateStatus) {
    if (!activeTemplate) return;
    const merged: EmailTemplate = { ...activeTemplate, status };
    updateActiveTemplate({ status });
    try {
      await emailTemplateService.updateTemplate(activeTemplate.id, localToDbForm(merged));
      showToast(`Saved as ${STATUS_LABEL[status]}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save template.');
    }
  }

  async function handleSendTestEmail() {
    if (!testEmployeeId || !activeTemplate) return;
    const emp = employees.find((e) => e.id === testEmployeeId);
    setTestEmailOpen(false);
    if (!emp?.email) {
      showToast('That employee has no email on file.');
      return;
    }
    const result = await emailTemplateService.sendTestEmailRaw(emp.email, activeTemplate.subject, activeTemplate.bodyHtml, activeTemplate.branding, previewValues());
    showToast(result.success ? `Test email sent to ${emp.first_name} ${emp.last_name}.` : `Failed to send: ${result.error}`);
  }

  // ── Variable preview values (from real, optionally-selected records) ───────

  function previewValues(): Record<string, string> {
    const emp = employees.find((e) => e.id === previewEmployeeId);
    const course = courses.find((c) => c.id === previewCourseId);
    const assessment = assessments.find((a) => a.id === previewAssessmentId);
    const lesson = lessons.find((l) => l.id === previewLessonId);
    const certificate = certificates.find((c) => c.id === previewCertificateId);
    const path = learningPaths.find((p) => p.id === previewPathId);
    return {
      '{{employee_name}}': emp ? `${emp.first_name} ${emp.last_name}` : '',
      '{{company_name}}': selectedCompany?.company_name ?? '',
      '{{course_name}}': course?.course_name ?? '',
      '{{assessment_name}}': assessment?.assessment_title ?? '',
      '{{assignment_name}}': lesson?.lesson_title ?? '',
      '{{certificate_name}}': certificate?.certificate_title ?? '',
      '{{trainer_name}}': '',
      '{{completion_percentage}}': '',
      '{{login_url}}': selectedCompany?.website || '',
      '{{support_email}}': selectedCompany?.email || '',
      '{{learning_path_name}}': path?.path_name ?? '',
    };
  }

  // ── Filtering ────────────────────────────────────────────────────────────────

  const searchTerm = search.trim().toLowerCase();
  const filteredTemplates = templates.filter((t) => {
    if (searchTerm && !t.name.toLowerCase().includes(searchTerm) && !t.subject.toLowerCase().includes(searchTerm)) return false;
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    return true;
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <Skeleton />;
  if (error) return <ErrorState message={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">

      {/* TOP BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Branding Company</span>
          <select value={selectedCompanyId} onChange={(e) => setSelectedCompanyId(e.target.value)} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400/40">
            {companies.map((c) => (<option key={c.id} value={c.id}>{c.company_name}</option>))}
          </select>
        </div>
        <PrimaryButton onClick={handleCreate}><IconPlus className="h-3.5 w-3.5" /> Create Template</PrimaryButton>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">

        {/* LEFT PANEL */}
        <div className="rounded-2xl bg-white p-4 shadow-sm lg:sticky lg:top-6 lg:h-fit">
          <p className="mb-3 text-sm font-bold text-slate-800">Templates</p>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates…" className={`${INPUT_CLS} mb-2`} />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as 'all' | TemplateType)} className={`${INPUT_CLS} mb-2`}>
            <option value="all">All Categories</option>
            {TEMPLATE_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | TemplateStatus)} className={`${INPUT_CLS} mb-3`}>
            <option value="all">All Statuses</option>
            {(Object.keys(STATUS_LABEL) as TemplateStatus[]).map((s) => (<option key={s} value={s}>{STATUS_LABEL[s]}</option>))}
          </select>

          {filteredTemplates.length === 0 ? (
            <EmptyState message="No templates yet — create one to get started." />
          ) : (
            <div className="max-h-[480px] space-y-1 overflow-y-auto">
              {filteredTemplates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTemplateId(t.id)}
                  className={`flex w-full flex-col gap-1 rounded-xl px-3 py-2.5 text-left transition ${activeTemplateId === t.id ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-800">{t.name}</span>
                    <StatusBadge status={t.status} />
                  </div>
                  <span className="truncate text-xs text-slate-400">{TYPE_LABEL[t.category]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* CENTER */}
        <div className="space-y-6">
          {!activeTemplate ? (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <EmptyState message="Select a template, or create a new one." />
            </div>
          ) : (
            <>
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <StatusBadge status={activeTemplate.status} />
                  <div className="flex flex-wrap gap-2">
                    <SecondaryButton onClick={() => handleDuplicate(activeTemplate)}><IconDuplicate /> Duplicate</SecondaryButton>
                    <SecondaryButton onClick={() => setPreviewOpen(true)}><IconEye className="h-3.5 w-3.5" /> Preview</SecondaryButton>
                    <SecondaryButton onClick={() => setTestEmailOpen(true)}>Send Test Email</SecondaryButton>
                    <SecondaryButton onClick={() => setStatus('draft')}>Save Draft</SecondaryButton>
                    <AccentButton onClick={() => setStatus('published')}>Publish</AccentButton>
                    <SecondaryButton onClick={() => setStatus('archived')}>Archive</SecondaryButton>
                    <DangerButton onClick={() => setDeleteTarget(activeTemplate)}><IconTrash /> Delete</DangerButton>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Email Name">
                    <input value={activeTemplate.name} onChange={(e) => updateActiveTemplate({ name: e.target.value })} className={INPUT_CLS} />
                  </Field>
                  <Field label="Category">
                    <select value={activeTemplate.category} onChange={(e) => updateActiveTemplate({ category: e.target.value as TemplateType })} className={INPUT_CLS}>
                      {TEMPLATE_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                    </select>
                  </Field>
                </div>
                <div className="mt-4">
                  <Field label="Subject">
                    <input value={activeTemplate.subject} onChange={(e) => updateActiveTemplate({ subject: e.target.value })} placeholder="e.g. Welcome to {{company_name}}, {{employee_name}}!" className={INPUT_CLS} />
                  </Field>
                </div>

                <div className="mt-4">
                  <p className="mb-1 text-xs font-semibold text-slate-500">Rich HTML Editor</p>
                  <RichHtmlEditor html={activeTemplate.bodyHtml} onChange={(html) => updateActiveTemplate({ bodyHtml: html })} />
                </div>

                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold text-slate-500">Variables</p>
                  <div className="flex flex-wrap gap-1.5">
                    {VARIABLES.map((v) => (
                      <span key={v} className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[11px] text-slate-500">{v}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* BRANDING */}
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Branding</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Company Logo URL">
                    <input value={activeTemplate.branding.logoUrl} onChange={(e) => updateActiveBranding({ logoUrl: e.target.value })} className={INPUT_CLS} />
                  </Field>
                  <Field label="Header Text">
                    <input value={activeTemplate.branding.headerText} onChange={(e) => updateActiveBranding({ headerText: e.target.value })} className={INPUT_CLS} />
                  </Field>
                </div>
                <div className="mt-4">
                  <Field label="Footer">
                    <textarea value={activeTemplate.branding.footerText} onChange={(e) => updateActiveBranding({ footerText: e.target.value })} rows={2} className={`${INPUT_CLS} resize-none`} />
                  </Field>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-4">
                  <Field label="Primary Color">
                    <div className="flex items-center gap-2">
                      <input type="color" value={activeTemplate.branding.primaryColor} onChange={(e) => updateActiveBranding({ primaryColor: e.target.value })} className="h-9 w-9 flex-shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0" />
                      <input value={activeTemplate.branding.primaryColor} onChange={(e) => updateActiveBranding({ primaryColor: e.target.value })} className={INPUT_CLS} />
                    </div>
                  </Field>
                  <Field label="Secondary Color">
                    <div className="flex items-center gap-2">
                      <input type="color" value={activeTemplate.branding.secondaryColor} onChange={(e) => updateActiveBranding({ secondaryColor: e.target.value })} className="h-9 w-9 flex-shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0" />
                      <input value={activeTemplate.branding.secondaryColor} onChange={(e) => updateActiveBranding({ secondaryColor: e.target.value })} className={INPUT_CLS} />
                    </div>
                  </Field>
                  <Field label="Button Color">
                    <div className="flex items-center gap-2">
                      <input type="color" value={activeTemplate.branding.buttonColor} onChange={(e) => updateActiveBranding({ buttonColor: e.target.value })} className="h-9 w-9 flex-shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0" />
                      <input value={activeTemplate.branding.buttonColor} onChange={(e) => updateActiveBranding({ buttonColor: e.target.value })} className={INPUT_CLS} />
                    </div>
                  </Field>
                </div>
              </div>

              {/* PREVIEW */}
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Preview</h3>
                  <div className="flex gap-2">
                    <SecondaryButton onClick={() => setPreviewMode('desktop')} className={previewMode === 'desktop' ? 'ring-2 ring-indigo-400' : ''}><IconDesktop /> Desktop</SecondaryButton>
                    <SecondaryButton onClick={() => setPreviewMode('mobile')} className={previewMode === 'mobile' ? 'ring-2 ring-indigo-400' : ''}><IconMobile /> Mobile</SecondaryButton>
                  </div>
                </div>

                <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <select value={previewEmployeeId} onChange={(e) => setPreviewEmployeeId(e.target.value)} className="rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                    <option value="">Preview Employee…</option>
                    {employees.map((e) => (<option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>))}
                  </select>
                  <select value={previewCourseId} onChange={(e) => setPreviewCourseId(e.target.value)} className="rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                    <option value="">Preview Course…</option>
                    {courses.map((c) => (<option key={c.id} value={c.id}>{c.course_name}</option>))}
                  </select>
                  <select value={previewAssessmentId} onChange={(e) => setPreviewAssessmentId(e.target.value)} className="rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                    <option value="">Preview Assessment…</option>
                    {assessments.map((a) => (<option key={a.id} value={a.id}>{a.assessment_title}</option>))}
                  </select>
                  <select value={previewLessonId} onChange={(e) => setPreviewLessonId(e.target.value)} className="rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                    <option value="">Preview Assignment…</option>
                    {lessons.filter((l) => l.lesson_type === 'assignment').map((l) => (<option key={l.id} value={l.id}>{l.lesson_title}</option>))}
                  </select>
                  <select value={previewCertificateId} onChange={(e) => setPreviewCertificateId(e.target.value)} className="rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                    <option value="">Preview Certificate…</option>
                    {certificates.map((c) => (<option key={c.id} value={c.id}>{c.certificate_title}</option>))}
                  </select>
                  <select value={previewPathId} onChange={(e) => setPreviewPathId(e.target.value)} className="rounded-lg bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                    <option value="">Preview Learning Path…</option>
                    {learningPaths.map((p) => (<option key={p.id} value={p.id}>{p.path_name}</option>))}
                  </select>
                </div>

                <EmailPreview template={activeTemplate} values={previewValues()} mode={previewMode} />
              </div>
            </>
          )}
        </div>
      </div>

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDeleteTarget(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold text-slate-900">Delete Template</h3>
            <p className="mb-5 text-sm text-slate-500">Delete "{deleteTarget.name}"? This cannot be undone.</p>
            <div className="flex justify-end gap-2">
              <SecondaryButton onClick={() => setDeleteTarget(null)}>Cancel</SecondaryButton>
              <DangerButton onClick={handleDeleteConfirm}><IconTrash /> Delete</DangerButton>
            </div>
          </div>
        </div>
      )}

      {testEmailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setTestEmailOpen(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Send Test Email</h3>
              <button onClick={() => setTestEmailOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><IconX /></button>
            </div>
            <Field label="Recipient">
              <select value={testEmployeeId} onChange={(e) => setTestEmployeeId(e.target.value)} className={INPUT_CLS}>
                <option value="">Select employee…</option>
                {employees.map((e) => (<option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>))}
              </select>
            </Field>
            <p className="mt-3 text-xs text-slate-400">Sends the compiled email to that employee's real address via your connected email provider.</p>
            <div className="mt-5 flex justify-end gap-2">
              <SecondaryButton onClick={() => setTestEmailOpen(false)}>Cancel</SecondaryButton>
              <PrimaryButton onClick={handleSendTestEmail} disabled={!testEmployeeId}>Send Test</PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {previewOpen && activeTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setPreviewOpen(false)} />
          <div className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-8 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Full Preview</h3>
              <button onClick={() => setPreviewOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><IconX /></button>
            </div>
            <div className="mb-4 flex gap-2">
              <SecondaryButton onClick={() => setPreviewMode('desktop')} className={previewMode === 'desktop' ? 'ring-2 ring-indigo-400' : ''}><IconDesktop /> Desktop</SecondaryButton>
              <SecondaryButton onClick={() => setPreviewMode('mobile')} className={previewMode === 'mobile' ? 'ring-2 ring-indigo-400' : ''}><IconMobile /> Mobile</SecondaryButton>
            </div>
            <EmailPreview template={activeTemplate} values={previewValues()} mode={previewMode} />
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default EmailTemplateBuilder;