// src/components/certificate/CertificateViewPage.tsx
//
// The missing piece: lets an employee actually VIEW and DOWNLOAD their
// own already-issued certificate, on demand — no email, no WhatsApp,
// no external service. Renders the real CertificateRenderer live, then
// converts that exact SVG to a PNG in-browser for download.

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { loadCertificateForView } from '../../services/certificate/certificateViewService';
import CertificateRenderer from './CertificateRenderer';
import type { CertificateViewData } from '../../services/certificate/certificateViewService';

function IconDownload({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 12m0 0 4.5-4.5M12 12V3" /></svg>);
}
function IconSpinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (<svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" /></svg>);
}

function CertificateViewPage() {
  const { certificateId } = useParams<{ certificateId: string }>();
  const [data, setData] = useState<CertificateViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!certificateId) {
      setError('No certificate specified.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    loadCertificateForView(certificateId)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load certificate.'))
      .finally(() => setLoading(false));
  }, [certificateId]);

  function handleDownload() {
    const svgEl = svgContainerRef.current?.querySelector('svg');
    if (!svgEl || !data) return;

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
          a.download = `Certificate-${data.certificate.certificate_no}.png`;
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

  if (loading) {
    return <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />;
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error || 'Certificate not found.'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{data.certificate.certificate_title}</h2>
          <p className="text-sm text-slate-500">Certificate No: {data.certificate.certificate_no} · Issued {new Date(data.certificate.issue_date).toLocaleDateString()}</p>
        </div>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center gap-2 rounded-xl bg-yellow-500 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50 active:scale-95"
        >
          {downloading ? <IconSpinner className="h-3.5 w-3.5" /> : <IconDownload className="h-4 w-4" />} Download
        </button>
      </div>

      <div ref={svgContainerRef} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CertificateRenderer
          template={data.template}
          data={{
            employeeName: data.employeeName,
            courseName: data.courseName,
            issueDate: new Date(data.certificate.issue_date).toLocaleDateString(),
            certificateNo: data.certificate.certificate_no,
          }}
        />
      </div>
    </div>
  );
}

export default CertificateViewPage;
