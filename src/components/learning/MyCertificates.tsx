// src/components/learning/MyCertificates.tsx
//
// Professional Training App Certificate Center — Dashboard + Certificate
// Details, self-contained in this one file.
//
// Reuses only existing, unmodified services:
//   myCertificateService.loadMyCertificates() — certificate records
//   myCourseService.loadMyCourses()           — cross-referenced only to
//                                               surface a real Completion
//                                               Date and a real "course not
//                                               completed" eligibility
//                                               reason for certificates
//                                               that exist but aren't
//                                               issued yet (both already
//                                               existing services, not new)
//   session.getCurrentUser()                  — Employee Name
//
// UPDATED: certificate.certificateUrl is always empty (no static file is
// ever generated for a certificate) — Preview/Download/Print now use the
// real, live-rendered certificate (certificateViewService +
// CertificateRenderer), the same pieces already wired into LearningHome's
// "View Certificate" link. Share now shares by text only, since there is
// no real URL to share.

import { useEffect, useMemo, useState } from 'react';
import { loadMyCertificates } from '../../services/myCertificate/myCertificateService';
import { loadMyCourses }      from '../../services/myCourses/myCourseService';
import { getCurrentUser }     from '../../services/auth/session';
import { loadCertificateForView } from '../../services/certificate/certificateViewService';
import CertificateRenderer from '../certificate/CertificateRenderer';
import type { MyCertificate, MyCertificateStatus } from '../../types/myCertificate';
import type { MyCourse } from '../../types/myCourse';
import type { CertificateViewData } from '../../services/certificate/certificateViewService';

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<MyCertificateStatus, string> = {
  valid:   'Issued',
  expired: 'Expired',
  pending: 'Eligible',
};

const STATUS_STYLES: Record<MyCertificateStatus, string> = {
  valid:   'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  expired: 'bg-red-50     text-red-700     ring-1 ring-red-200',
  pending: 'bg-amber-50   text-amber-700   ring-1 ring-amber-200',
};

function StatusBadge({ status }: { status: MyCertificateStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading / Empty / Error states
// ─────────────────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="h-48 animate-pulse rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      <p className="font-semibold">Failed to load certificates</p>
      <p className="mt-1">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm font-medium transition hover:bg-red-100"
      >
        Try Again
      </button>
    </div>
  );
}

function EmptyState({ search }: { search: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-20 text-center text-slate-400">
      <svg className="h-14 w-14 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.623 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
      </svg>
      <p className="font-medium">
        {search
          ? `No certificates match "${search}".`
          : 'No certificates yet. Complete your courses to earn certificates.'}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Certificate card (dashboard)
// ─────────────────────────────────────────────────────────────────────────────

function CertificateCard({ certificate, onOpen }: { certificate: MyCertificate; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-yellow-50 text-yellow-600">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.623 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
          </svg>
        </span>
        <StatusBadge status={certificate.status} />
      </div>

      <div className="mb-4 min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-slate-800">{certificate.certificateTitle}</p>
        {certificate.courseName && (
          <p className="mt-0.5 truncate text-sm text-slate-500">{certificate.courseName}</p>
        )}
        {certificate.certificateNumber && (
          <span className="mt-2 inline-block rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-500">
            {certificate.certificateNumber}
          </span>
        )}

        <div className="mt-3 grid grid-cols-2 gap-y-1 text-xs text-slate-500">
          {certificate.status !== 'pending' && (
            <div>
              <p className="text-slate-400">Issue Date</p>
              <p className="font-medium text-slate-700">{formatDate(certificate.issueDate)}</p>
            </div>
          )}
        </div>
      </div>

      <span className="mt-auto inline-flex items-center gap-1 text-sm font-semibold text-yellow-600">
        View Details
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Certificate Details
// ─────────────────────────────────────────────────────────────────────────────

function CertificateDetails({
  certificate, employeeName, matchedCourse, onBack,
}: {
  certificate:   MyCertificate;
  employeeName:  string;
  matchedCourse: MyCourse | null;
  onBack:        () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [toast,  setToast]  = useState('');
  const [viewData, setViewData] = useState<CertificateViewData | null>(null);
  const [loadingView, setLoadingView] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const isIssued = certificate.status !== 'pending';

  useEffect(() => {
    if (!isIssued) {
      setLoadingView(false);
      return;
    }
    setLoadingView(true);
    loadCertificateForView(certificate.id)
      .then(setViewData)
      .catch(() => setViewData(null))
      .finally(() => setLoadingView(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certificate.id, isIssued]);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(''), 2200);
  }

  async function handleCopyId() {
    try {
      await navigator.clipboard.writeText(certificate.certificateNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      showToast('Could not copy — copy manually instead.');
    }
  }

  async function handleShare() {
    const shareText = `${certificate.certificateTitle} — ${certificate.courseName} (Certificate No: ${certificate.certificateNumber})`;
    const nav = navigator as Navigator & { share?: (data: { title: string; text: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title: certificate.certificateTitle, text: shareText });
      } catch {
        // user cancelled — no action needed
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        showToast('Certificate details copied to clipboard');
      } catch {
        showToast('Sharing is not supported on this browser.');
      }
    }
  }

  function handlePrint() {
    window.print();
  }

  function handleDownload() {
    const svgEl = document.getElementById('certificate-preview-svg')?.querySelector('svg');
    if (!svgEl) {
      showToast('Certificate is still loading — try again in a moment.');
      return;
    }
    setDownloading(true);
    try {
      const viewBox = svgEl.getAttribute('viewBox')?.split(' ').map(Number) ?? [0, 0, 1122, 793];
      const [, , svgWidth, svgHeight] = viewBox;

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgEl);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = new Image();
      img.onload = () => {
        const scale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = svgWidth * scale;
        canvas.height = svgHeight * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setDownloading(false);
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, svgWidth, svgHeight);
        URL.revokeObjectURL(url);

        canvas.toBlob((blob) => {
          if (!blob) {
            setDownloading(false);
            return;
          }
          const downloadUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `Certificate-${certificate.certificateNumber || certificate.id}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(downloadUrl);
          setDownloading(false);
        }, 'image/png');
      };
      img.onerror = () => setDownloading(false);
      img.src = url;
    } catch {
      setDownloading(false);
    }
  }

  const eligibilityReasons: string[] = [];
  if (!isIssued && matchedCourse && matchedCourse.status !== 'COMPLETED') {
    eligibilityReasons.push('Course not completed');
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">
      <button
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        Back to My Certificates
      </button>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-6">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-slate-800">{certificate.certificateTitle}</h2>
          <p className="mt-1 text-slate-500">{certificate.courseName}</p>
        </div>
        <StatusBadge status={certificate.status} />
      </div>

      {/* Certificate Preview — now the real, live-rendered certificate */}
      <div className="mb-8">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Certificate Preview</h3>
        {!isIssued ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-20 text-center text-slate-400">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.623 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
            <p className="font-medium">Your certificate hasn't been issued yet.</p>
          </div>
        ) : loadingView ? (
          <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
        ) : viewData ? (
          <div id="certificate-preview-svg" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <CertificateRenderer
              template={viewData.template}
              data={{
                employeeName: viewData.employeeName,
                courseName: viewData.courseName || certificate.courseName,
                issueDate: formatDate(certificate.issueDate),
                certificateNo: certificate.certificateNumber,
              }}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-20 text-center text-slate-400">
            <p className="font-medium">Certificate design could not be loaded.</p>
          </div>
        )}
      </div>

      {/* Details grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 rounded-2xl bg-slate-50 p-6 sm:grid-cols-3">
        <div>
          <p className="text-xs text-slate-400">Certificate Number</p>
          <p className="font-mono text-sm font-semibold text-slate-800">{certificate.certificateNumber || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Employee Name</p>
          <p className="text-sm font-semibold text-slate-800">{employeeName || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">Course Name</p>
          <p className="text-sm font-semibold text-slate-800">{certificate.courseName || '—'}</p>
        </div>
        {isIssued && (
          <div>
            <p className="text-xs text-slate-400">Issued Date</p>
            <p className="text-sm font-semibold text-slate-800">{formatDate(certificate.issueDate)}</p>
          </div>
        )}
        {matchedCourse?.completedAt && (
          <div>
            <p className="text-xs text-slate-400">Completion Date</p>
            <p className="text-sm font-semibold text-slate-800">{formatDate(matchedCourse.completedAt)}</p>
          </div>
        )}
        {isIssued && (
          <div>
            <p className="text-xs text-slate-400">Validity</p>
            <p className="text-sm font-semibold text-slate-800">
              {certificate.expiryDate ? `Valid until ${formatDate(certificate.expiryDate)}` : 'No Expiry'}
            </p>
          </div>
        )}
      </div>

      {/* Buttons */}
      {isIssued && (
        <div className="mb-8 flex flex-wrap gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading || loadingView || !viewData}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-yellow-500 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-yellow-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            {downloading ? 'Downloading…' : 'Download Certificate'}
          </button>
          <button
            onClick={handlePrint}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
          >
            Print Certificate
          </button>
          <button
            onClick={handleShare}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
          >
            Share
          </button>
          <button
            onClick={handleCopyId}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50"
          >
            {copied ? 'Copied!' : 'Copy Certificate ID'}
          </button>
        </div>
      )}

      {/* Verification */}
      <div className="mb-8 rounded-2xl border border-slate-200 p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">Verification</h3>
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          {certificate.qrCodeUrl ? (
            <img src={certificate.qrCodeUrl} alt="Verification QR Code" className="h-28 w-28 flex-shrink-0 rounded-xl border border-slate-200 object-contain p-2" />
          ) : (
            <div className="flex h-28 w-28 flex-shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-center text-[11px] text-slate-400">
              QR Code<br />Not Available
            </div>
          )}
          <div>
            <p className="text-xs text-slate-400">Certificate ID</p>
            <p className="mb-3 font-mono text-sm font-semibold text-slate-800">{certificate.certificateNumber || '—'}</p>
            <p className="text-xs text-slate-400">Verification Status</p>
            <p className={`text-sm font-semibold ${
              certificate.status === 'valid' ? 'text-emerald-600' : certificate.status === 'expired' ? 'text-red-600' : 'text-amber-600'
            }`}>
              {certificate.status === 'valid' ? 'Verified — Issued' : certificate.status === 'expired' ? 'Verified — Expired' : 'Not Yet Issued'}
            </p>
          </div>
        </div>
      </div>

      {/* Eligibility */}
      {!isIssued && eligibilityReasons.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-700">Eligibility</h3>
          <ul className="space-y-1.5 text-sm text-amber-800">
            {eligibilityReasons.map((reason) => (
              <li key={reason} className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
                {reason}
              </li>
            ))}
          </ul>
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

// ─────────────────────────────────────────────────────────────────────────────
// Main MyCertificates
// ─────────────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | MyCertificateStatus;

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all',     label: 'All' },
  { value: 'pending', label: 'Eligible' },
  { value: 'valid',   label: 'Issued' },
  { value: 'expired', label: 'Expired' },
];

function MyCertificates() {
  const user = getCurrentUser();

  const [certificates, setCertificates] = useState<MyCertificate[]>([]);
  const [courses,      setCourses]      = useState<MyCourse[]>([]);
  const [loading,       setLoading]     = useState(true);
  const [error,         setError]       = useState('');

  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [activeCertificateId, setActiveCertificateId] = useState('');

  function fetchAll() {
    if (!user?.id) {
      setError('No active session.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    Promise.all([loadMyCertificates(user.id), loadMyCourses(user.id)])
      .then(([certRows, courseRows]) => {
        setCertificates(certRows);
        setCourses(courseRows);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load certificates.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const courseOptions = useMemo(() => {
    const names = new Set(certificates.map((c) => c.courseName).filter(Boolean));
    return Array.from(names);
  }, [certificates]);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return certificates.filter((c) => {
      const matchesSearch =
        !kw ||
        c.certificateTitle.toLowerCase().includes(kw) ||
        c.certificateNumber.toLowerCase().includes(kw) ||
        c.courseName.toLowerCase().includes(kw);
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchesCourse = courseFilter === 'all' || c.courseName === courseFilter;
      return matchesSearch && matchesStatus && matchesCourse;
    });
  }, [certificates, search, statusFilter, courseFilter]);

  const activeCertificate = certificates.find((c) => c.id === activeCertificateId) ?? null;
  const matchedCourse = activeCertificate
    ? courses.find((c) => c.courseCode === activeCertificate.courseCode || c.courseName === activeCertificate.courseName) ?? null
    : null;
  const employeeName = user ? `${user.firstName} ${user.lastName}`.trim() : '';

  if (activeCertificate) {
    return (
      <CertificateDetails
        certificate={activeCertificate}
        employeeName={employeeName}
        matchedCourse={matchedCourse}
        onBack={() => setActiveCertificateId('')}
      />
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Certificate Center</h2>
          <p className="mt-1 text-slate-500">Certificates you've earned and are eligible for.</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          className="min-w-[220px] flex-1 rounded-xl border border-slate-200 p-3 text-sm focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-100"
          placeholder="Search by certificate name, number or course..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {courseOptions.length > 0 && (
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="rounded-xl border border-slate-200 p-3 text-sm text-slate-700 focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-100"
          >
            <option value="all">All Courses</option>
            {courseOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                statusFilter === opt.value
                  ? 'bg-yellow-500 text-slate-900'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={fetchAll} />}

      {loading && <Skeleton />}

      {!loading && !error && filtered.length === 0 && <EmptyState search={search} />}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((certificate) => (
            <CertificateCard
              key={certificate.id}
              certificate={certificate}
              onOpen={() => setActiveCertificateId(certificate.id)}
            />
          ))}
        </div>
      )}

    </div>
  );
}

export default MyCertificates;