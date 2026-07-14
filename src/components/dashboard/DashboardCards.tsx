// src/components/dashboard/DashboardCards.tsx
//
// Real statistics computed from existing, unmodified services — reuses
// the existing StatsCard presentational component exactly as before, no
// mock data, no hardcoded numbers.

import { useEffect, useState } from 'react';
import StatsCard from './StatsCard';

import { employeeService } from '../../services/employee/employeeService';
import { loadCourses } from '../../services/course/courseService';
import { loadLearningPaths } from '../../services/learningPath/learningPathService';
import { loadAssessments } from '../../services/assessment/assessmentService';
import { loadCertificates } from '../../services/certificate/certificateService';
import { loadEnrollments } from '../../services/enrollment/enrollmentService';

interface Stats {
  totalEmployees: number;
  activeEmployees: number;
  totalCourses: number;
  publishedCourses: number;
  totalPaths: number;
  publishedPaths: number;
  totalAssessments: number;
  activeAssessments: number;
  certificatesIssued: number;
  totalEnrollments: number;
  completedEnrollments: number;
}

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-100" />)}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load dashboard statistics</p>
      <p className="mt-1">{message}</p>
      <button onClick={onRetry} className="mt-4 rounded-xl border border-red-300 px-4 py-2 text-sm font-medium transition hover:bg-red-100">
        Try Again
      </button>
    </div>
  );
}

function DashboardCards() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function fetchStats() {
    setLoading(true);
    setError('');
    Promise.all([
      employeeService.getAll(),
      loadCourses(),
      loadLearningPaths(),
      loadAssessments(),
      loadCertificates(),
      loadEnrollments(),
    ])
      .then(([employees, courses, learningPaths, assessments, certificates, enrollments]) => {
        setStats({
          totalEmployees: employees.length,
          activeEmployees: employees.filter((e) => e.active).length,
          totalCourses: courses.length,
          publishedCourses: courses.filter((c) => c.active).length,
          totalPaths: learningPaths.length,
          publishedPaths: learningPaths.filter((p) => p.published).length,
          totalAssessments: assessments.length,
          activeAssessments: assessments.filter((a) => a.active).length,
          certificatesIssued: certificates.filter((c) => c.generated).length,
          totalEnrollments: enrollments.length,
          completedEnrollments: enrollments.filter((e) => e.status === 'COMPLETED').length,
        });
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load statistics.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) return <Skeleton />;
  if (error || !stats) return <ErrorState message={error || 'No data available.'} onRetry={fetchStats} />;

  const cards = [
    { title: 'Total Employees', value: stats.totalEmployees, color: 'bg-indigo-500' },
    { title: 'Active Employees', value: stats.activeEmployees, color: 'bg-blue-500' },
    { title: 'Total Courses', value: stats.totalCourses, color: 'bg-emerald-500' },
    { title: 'Published Courses', value: stats.publishedCourses, color: 'bg-teal-500' },
    { title: 'Learning Paths', value: stats.totalPaths, color: 'bg-fuchsia-500' },
    { title: 'Published Learning Paths', value: stats.publishedPaths, color: 'bg-purple-500' },
    { title: 'Total Assessments', value: stats.totalAssessments, color: 'bg-amber-500' },
    { title: 'Active Assessments', value: stats.activeAssessments, color: 'bg-orange-500' },
    { title: 'Certificates Issued', value: stats.certificatesIssued, color: 'bg-violet-500' },
    { title: 'Total Enrollments', value: stats.totalEnrollments, color: 'bg-cyan-500' },
    { title: 'Completed Enrollments', value: stats.completedEnrollments, color: 'bg-green-500' },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <StatsCard key={card.title} title={card.title} value={card.value} color={card.color} />
      ))}
    </div>
  );
}

export default DashboardCards;
