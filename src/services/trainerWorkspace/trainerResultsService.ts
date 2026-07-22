// src/services/trainerWorkspace/trainerResultsService.ts
//
// Real, filterable assessment results for a Trainer's own students —
// searchable by student/course, filterable by pass/fail, with a real
// CSV export (no external service needed, built in the browser).

import { loadResults } from '../assessmentResult/assessmentResultService';
import { loadAssessments } from '../assessment/assessmentService';
import { loadTrainerStudents } from './trainerStudentsService';

export interface TrainerResultRow {
  employeeId: string;
  employeeName: string;
  assessmentTitle: string;
  percentage: number;
  passed: boolean;
  grade: string;
  evaluatedAt: string;
}

export async function loadTrainerResults(trainerId: string): Promise<TrainerResultRow[]> {
  const students = await loadTrainerStudents(trainerId);
  const employeeIds = new Set(students.map((s) => s.employeeId));
  const employeeNameById = new Map(students.map((s) => [s.employeeId, s.employeeName]));

  const [results, assessments] = await Promise.all([loadResults(), loadAssessments()]);
  const assessmentById = new Map(assessments.map((a) => [a.id, a]));

  return results
    .filter((r) => employeeIds.has(r.employee_id))
    .map((r) => ({
      employeeId: r.employee_id,
      employeeName: employeeNameById.get(r.employee_id) ?? 'Unknown',
      assessmentTitle: assessmentById.get(r.assessment_id)?.assessment_title ?? 'Unknown Assessment',
      percentage: r.percentage,
      passed: r.passed,
      grade: r.grade,
      evaluatedAt: r.evaluated_at,
    }));
}

/**
 * Builds a real, downloadable CSV file from result rows — generated
 * entirely in the browser, no server or external service involved.
 */
export function exportResultsToCsv(rows: TrainerResultRow[]): void {
  const header = ['Student', 'Assessment', 'Percentage', 'Result', 'Grade', 'Evaluated At'];
  const lines = rows.map((r) => [
    r.employeeName,
    r.assessmentTitle,
    `${r.percentage}%`,
    r.passed ? 'Pass' : 'Fail',
    r.grade,
    r.evaluatedAt ? new Date(r.evaluatedAt).toLocaleDateString() : '',
  ]);

  const csvContent = [header, ...lines]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `student-results-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
