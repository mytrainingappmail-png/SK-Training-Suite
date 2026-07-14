// src/repositories/myCertificate/myCertificateRepository.ts
//
// Supabase queries only — zero business logic.
// Nested relations typed as Array (Supabase JS always returns arrays for
// to-many joins and may return a single object or array for to-one joins
// depending on FK direction), normalised to single objects before returning.

import { supabase } from '../../lib/supabase';
import type { MyCertificate, MyCertificateStatus } from '../../types/myCertificate';

// ── Private Supabase-shaped interfaces ───────────────────────────────────────

interface SBCourse {
  id:          string;
  course_name: string;
  course_code: string;
}

interface SBModule {
  id:        string;
  course_id: string;
  courses:   SBCourse | SBCourse[] | null;
}

interface SBLesson {
  id:        string;
  module_id: string;
  modules:   SBModule | SBModule[] | null;
}

interface SBAssessment {
  id:        string;
  lesson_id: string;
  lessons:   SBLesson | SBLesson[] | null;
}

interface SBCertificateRow {
  id:                string;
  certificate_no:    string;
  certificate_title: string;
  issue_date:        string;
  expiry_date:       string | null;
  certificate_url:   string;
  qr_code_url:       string;
  generated:         boolean;
  published:         boolean;
  active:            boolean;
  assessment_id:     string;
  assessments:       SBAssessment | SBAssessment[] | null;
}

const SELECT_QUERY = `
  id,
  certificate_no,
  certificate_title,
  issue_date,
  expiry_date,
  certificate_url,
  qr_code_url,
  generated,
  published,
  active,
  assessment_id,
  assessments (
    id,
    lesson_id,
    lessons (
      id,
      module_id,
      modules (
        id,
        course_id,
        courses (
          id,
          course_name,
          course_code
        )
      )
    )
  )
`;

// ── Normalise helpers ─────────────────────────────────────────────────────────

function unwrap<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function resolveCourse(row: SBCertificateRow): SBCourse | null {
  const assessment = unwrap(row.assessments);
  const lesson     = assessment ? unwrap(assessment.lessons) : null;
  const module_     = lesson    ? unwrap(lesson.modules)      : null;
  const course      = module_   ? unwrap(module_.courses)     : null;
  return course;
}

function deriveStatus(row: SBCertificateRow): MyCertificateStatus {
  if (!row.generated) return 'pending';
  if (row.expiry_date) {
    const expiry = new Date(row.expiry_date).getTime();
    if (!Number.isNaN(expiry) && expiry < Date.now()) return 'expired';
  }
  return 'valid';
}

function normaliseCertificate(row: SBCertificateRow): MyCertificate {
  const course = resolveCourse(row);

  return {
    id:                row.id,
    certificateNumber: row.certificate_no    ?? '',
    certificateTitle:  row.certificate_title ?? 'Certificate',
    courseName:        course?.course_name   ?? '',
    courseCode:        course?.course_code   ?? '',
    issueDate:         row.issue_date        ?? '',
    expiryDate:        row.expiry_date       ?? null,
    certificateUrl:    row.certificate_url   ?? '',
    qrCodeUrl:         row.qr_code_url       ?? '',
    status:            deriveStatus(row),
  };
}

// ── Public repository functions ───────────────────────────────────────────────

export async function getMyCertificates(employeeId: string): Promise<MyCertificate[]> {
  const { data, error } = await supabase
    .from('certificates')
    .select(SELECT_QUERY)
    .eq('employee_id', employeeId)
    .eq('active', true)
    .order('issue_date', { ascending: false });

  if (error) {
    console.error('[myCertificateRepository] getMyCertificates:', error);
    throw new Error(error.message);
  }

  return (data as unknown as SBCertificateRow[] ?? []).map(normaliseCertificate);
}
