// src/components/certificate/CertificateRenderer.tsx
//
// Renders an actual visual certificate as SVG — used both for live
// preview in the template editor and for the real certificate shown
// to an employee. 9 structurally distinct, ready-made designs — every
// text element (title, subtitle, description with its own bold/color),
// logo position, and both signatures are driven by real template +
// issuance data.

import type { CertificateTemplate, DesignPreset } from '../../types/certificateTemplate';
import { fillCertificateText } from '../../types/certificateTemplate';

export interface CertificateRenderData {
  employeeName: string;
  courseName: string;
  issueDate: string;
  certificateNo: string;
}

interface CertificateRendererProps {
  template: CertificateTemplate;
  data: CertificateRenderData;
}

function CertificateRenderer({ template, data }: CertificateRendererProps) {
  const isPortrait = template.orientation === 'portrait';
  const width = isPortrait ? 793 : 1122;
  const height = isPortrait ? 1122 : 793;

  const subtitle = fillCertificateText(template.subtitle_text, {
    employeeName: data.employeeName, courseName: data.courseName, issueDate: data.issueDate, certificateNo: data.certificateNo,
  });
  const description = fillCertificateText(template.description_text, {
    employeeName: data.employeeName, courseName: data.courseName, issueDate: data.issueDate, certificateNo: data.certificateNo,
  });

  const qrX = template.qr_position.includes('left') ? 60 : width - 140;
  const qrY = template.qr_position.includes('top') ? 60 : template.qr_position === 'center' ? height / 2 - 40 : height - 130;

  const fontFamily = template.font_family || 'Arial';
  const fontSize = template.font_size || 14;
  const descColor = template.description_color || '#3F3F3F';
  const descWeight = template.description_bold ? 'bold' : 'normal';

  const descriptionBlock = (top: number) => (
    <foreignObject x={width * 0.16} y={top} width={width * 0.68} height={height * 0.24}>
      <div style={{ fontFamily, fontSize: `${fontSize}px`, color: descColor, fontWeight: descWeight, textAlign: 'center', lineHeight: 1.6 }}>
        {description}
      </div>
    </foreignObject>
  );

  const logoBlock = template.logo_url ? (
    template.logo_position === 'watermark_center' ? (
      <image href={template.logo_url} x={width / 2 - 160} y={height / 2 - 160} width="320" height="320" opacity={0.06} preserveAspectRatio="xMidYMid meet" />
    ) : template.logo_position === 'top_left' ? (
      <image href={template.logo_url} x="70" y="60" width="80" height="80" preserveAspectRatio="xMidYMid meet" />
    ) : template.logo_position === 'top_right' ? (
      <image href={template.logo_url} x={width - 150} y="60" width="80" height="80" preserveAspectRatio="xMidYMid meet" />
    ) : (
      <image href={template.logo_url} x={width / 2 - 40} y="55" width="80" height="80" preserveAspectRatio="xMidYMid meet" />
    )
  ) : null;

  const signatures = (nameColor = '#1E293B') => (
    <>
      <g>
        {template.signature_url && (
          <image href={template.signature_url} x={width * 0.18} y={height - 175} width="130" height="55" preserveAspectRatio="xMidYMid meet" />
        )}
        <line x1={width * 0.15} y1={height - 110} x2={width * 0.35} y2={height - 110} stroke="#64748B" strokeWidth="1" />
        <text x={width * 0.25} y={height - 90} textAnchor="middle" fontSize="13" fontWeight="600" fill={nameColor}>{template.signatory_1_name || 'Signatory 1'}</text>
        <text x={width * 0.25} y={height - 72} textAnchor="middle" fontSize="11" opacity={0.7} fill={nameColor}>{template.signatory_1_title}</text>
      </g>
      <g>
        {template.signature_2_url && (
          <image href={template.signature_2_url} x={width * 0.62} y={height - 175} width="130" height="55" preserveAspectRatio="xMidYMid meet" />
        )}
        <line x1={width * 0.65} y1={height - 110} x2={width * 0.85} y2={height - 110} stroke="#64748B" strokeWidth="1" />
        <text x={width * 0.75} y={height - 90} textAnchor="middle" fontSize="13" fontWeight="600" fill={nameColor}>{template.signatory_2_name || 'Signatory 2'}</text>
        <text x={width * 0.75} y={height - 72} textAnchor="middle" fontSize="11" opacity={0.7} fill={nameColor}>{template.signatory_2_title}</text>
      </g>
    </>
  );

  const qrBox = (strokeColor = '#000000') => (
    <>
      <rect x={qrX} y={qrY} width="80" height="80" fill="none" stroke={strokeColor} strokeWidth="1" strokeDasharray="4 3" />
      <text x={qrX + 40} y={qrY + 44} textAnchor="middle" fontSize="9" fill={strokeColor}>QR</text>
    </>
  );

  const certNo = (color = '#000000') => (
    <text x={width / 2} y={height - 28} textAnchor="middle" fontSize="10" opacity={0.55} fill={color}>Certificate No: {data.certificateNo}</text>
  );

  const contentTop = template.logo_url && template.logo_position !== 'watermark_center' ? 195 : 130;

  const preset: DesignPreset = template.design_preset;

  if (preset === 'modern_navy') {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ fontFamily: 'Helvetica, Arial, sans-serif', color: '#1E293B' }}>
        <rect width={width} height={height} fill="#FFFFFF" />
        <rect width={width} height="140" fill="#0F172A" />
        <polygon points={`${width - 140},0 ${width},0 ${width},140`} fill="#1E3A8A" opacity={0.5} />
        {template.logo_position === 'watermark_center' && logoBlock}
        {template.logo_url && template.logo_position !== 'watermark_center' && (
          <image href={template.logo_url} x={template.logo_position === 'top_left' ? 60 : template.logo_position === 'top_right' ? width - 140 : width / 2 - 35} y="30" width="70" height="70" preserveAspectRatio="xMidYMid meet" />
        )}
        <text x={width / 2} y="105" textAnchor="middle" fontSize="30" fill="#FFFFFF" fontWeight="bold" letterSpacing="2">{template.certificate_title}</text>
        <text x={width / 2} y="200" textAnchor="middle" fontSize="15" fill="#475569">{subtitle}</text>
        <text x={width / 2} y="250" textAnchor="middle" fontSize="40" fill="#0F172A" fontWeight="bold">{data.employeeName}</text>
        <rect x={width / 2 - 90} y="270" width="180" height="3" fill="#1E3A8A" />
        {descriptionBlock(300)}
        {signatures()}
        {qrBox()}
        {certNo()}
      </svg>
    );
  }

  if (preset === 'minimal_slate') {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ fontFamily: 'Helvetica, Arial, sans-serif', color: '#334155' }}>
        <rect width={width} height={height} fill="#FFFFFF" />
        <path d={`M40,80 L40,40 L80,40`} fill="none" stroke="#94A3B8" strokeWidth="2" />
        <path d={`M${width - 80},40 L${width - 40},40 L${width - 40},80`} fill="none" stroke="#94A3B8" strokeWidth="2" />
        <path d={`M40,${height - 80} L40,${height - 40} L80,${height - 40}`} fill="none" stroke="#94A3B8" strokeWidth="2" />
        <path d={`M${width - 80},${height - 40} L${width - 40},${height - 40} L${width - 40},${height - 80}`} fill="none" stroke="#94A3B8" strokeWidth="2" />
        {logoBlock}
        <text x={width / 2} y={contentTop - 40} textAnchor="middle" fontSize="12" letterSpacing="5" fill="#94A3B8" fontWeight="600">{template.certificate_title}</text>
        <text x={width / 2} y={contentTop + 10} textAnchor="middle" fontSize="14" fill="#64748B">{subtitle}</text>
        <text x={width / 2} y={contentTop + 65} textAnchor="middle" fontSize="42" fill="#1E293B" fontWeight="300">{data.employeeName}</text>
        <line x1={width / 2 - 120} y1={contentTop + 85} x2={width / 2 + 120} y2={contentTop + 85} stroke="#CBD5E1" strokeWidth="1" />
        {descriptionBlock(contentTop + 110)}
        {signatures()}
        {qrBox()}
        {certNo()}
      </svg>
    );
  }

  if (preset === 'royal_maroon') {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ fontFamily: 'Georgia, serif', color: '#3F3F3F' }}>
        <rect width={width} height={height} fill="#FFFCFB" />
        <rect x="18" y="18" width={width - 36} height={height - 36} fill="none" stroke="#7F1D1D" strokeWidth="8" />
        <rect x="30" y="30" width={width - 60} height={height - 60} fill="none" stroke="#B45309" strokeWidth="2" />
        <rect x="38" y="38" width={width - 76} height={height - 76} fill="none" stroke="#7F1D1D" strokeWidth="1" />
        {[[38, 38], [width - 38, 38], [38, height - 38], [width - 38, height - 38]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="10" fill="#7F1D1D" />
        ))}
        {logoBlock}
        <text x={width / 2} y={contentTop} textAnchor="middle" fontSize="30" fill="#7F1D1D" fontWeight="bold" letterSpacing="1">{template.certificate_title}</text>
        <text x={width / 2} y={contentTop + 40} textAnchor="middle" fontSize="14" fill="#5B5B5B" fontStyle="italic">{subtitle}</text>
        <text x={width / 2} y={contentTop + 95} textAnchor="middle" fontSize="36" fill="#3F3F3F" fontWeight="bold">{data.employeeName}</text>
        {descriptionBlock(contentTop + 120)}
        <circle cx={width / 2} cy={height - 150} r="34" fill="#7F1D1D" />
        <circle cx={width / 2} cy={height - 150} r="27" fill="none" stroke="#FFFCFB" strokeWidth="1.5" />
        <text x={width / 2} y={height - 145} textAnchor="middle" fontSize="10" fill="#FFFCFB" fontWeight="bold">SEAL</text>
        {signatures()}
        {qrBox()}
        {certNo()}
      </svg>
    );
  }

  if (preset === 'corporate_blue') {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ fontFamily: 'Helvetica, Arial, sans-serif', color: '#1E293B' }}>
        <defs>
          <linearGradient id="cbGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1D4ED8" />
            <stop offset="100%" stopColor="#3B82F6" />
          </linearGradient>
        </defs>
        <rect width={width} height={height} fill="#FFFFFF" />
        <rect x="0" y="0" width={width} height="18" fill="url(#cbGrad)" />
        <rect x="0" y={height - 18} width={width} height="18" fill="url(#cbGrad)" />
        {logoBlock}
        <text x={width / 2} y={contentTop} textAnchor="middle" fontSize="30" fill="#1D4ED8" fontWeight="bold">{template.certificate_title}</text>
        <rect x={width / 2 - 60} y={contentTop + 15} width="120" height="4" fill="url(#cbGrad)" />
        <text x={width / 2} y={contentTop + 55} textAnchor="middle" fontSize="14" fill="#64748B">{subtitle}</text>
        <text x={width / 2} y={contentTop + 105} textAnchor="middle" fontSize="38" fill="#0F172A" fontWeight="bold">{data.employeeName}</text>
        {descriptionBlock(contentTop + 130)}
        <line x1={width / 2} y1={height - 175} x2={width / 2} y2={height - 85} stroke="#E2E8F0" strokeWidth="1" />
        {signatures()}
        {qrBox()}
        {certNo()}
      </svg>
    );
  }

  if (preset === 'elegant_emerald') {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ fontFamily: 'Georgia, serif', color: '#374151' }}>
        <rect width={width} height={height} fill="#FBFEFC" />
        <rect x="26" y="26" width={width - 52} height={height - 52} rx="18" fill="none" stroke="#10B981" strokeWidth="2" />
        <rect x="38" y="38" width={width - 76} height={height - 76} rx="12" fill="none" stroke="#065F46" strokeWidth="1" />
        <path d={`M${width / 2 - 180},${contentTop + 55} Q${width / 2 - 100},${contentTop + 20} ${width / 2 - 20},${contentTop + 55}`} fill="none" stroke="#10B981" strokeWidth="2" />
        <path d={`M${width / 2 + 180},${contentTop + 55} Q${width / 2 + 100},${contentTop + 20} ${width / 2 + 20},${contentTop + 55}`} fill="none" stroke="#10B981" strokeWidth="2" />
        {logoBlock}
        <text x={width / 2} y={contentTop} textAnchor="middle" fontSize="28" fill="#065F46" fontWeight="bold" letterSpacing="1">{template.certificate_title}</text>
        <text x={width / 2} y={contentTop + 35} textAnchor="middle" fontSize="14" fontStyle="italic" fill="#4B5563">{subtitle}</text>
        <text x={width / 2} y={contentTop + 95} textAnchor="middle" fontSize="38" fill="#065F46" fontWeight="bold">{data.employeeName}</text>
        {descriptionBlock(contentTop + 120)}
        {signatures()}
        {qrBox()}
        {certNo()}
      </svg>
    );
  }

  if (preset === 'vibrant_sunset') {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <defs>
          <linearGradient id="sunsetGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F97316" />
            <stop offset="50%" stopColor="#EC4899" />
            <stop offset="100%" stopColor="#A21CAF" />
          </linearGradient>
        </defs>
        <rect width={width} height={height} fill="#FFF7ED" />
        <rect width={width} height={height} fill="url(#sunsetGrad)" opacity={0.08} />
        <rect x="0" y="0" width={width} height="24" fill="url(#sunsetGrad)" />
        <rect x="0" y={height - 24} width={width} height="24" fill="url(#sunsetGrad)" />
        <circle cx={width - 90} cy="90" r="55" fill="url(#sunsetGrad)" opacity={0.25} />
        <circle cx="90" cy={height - 90} r="70" fill="url(#sunsetGrad)" opacity={0.18} />
        {logoBlock}
        <text x={width / 2} y={contentTop} textAnchor="middle" fontSize="32" fill="#C2410C" fontWeight="bold" letterSpacing="1">{template.certificate_title}</text>
        <text x={width / 2} y={contentTop + 38} textAnchor="middle" fontSize="15" fill="#9D174D">{subtitle}</text>
        <text x={width / 2} y={contentTop + 95} textAnchor="middle" fontSize="40" fill="#831843" fontWeight="bold">{data.employeeName}</text>
        <rect x={width / 2 - 100} y={contentTop + 112} width="200" height="4" fill="url(#sunsetGrad)" rx="2" />
        {descriptionBlock(contentTop + 135)}
        {signatures('#831843')}
        {qrBox('#C2410C')}
        {certNo('#9D174D')}
      </svg>
    );
  }

  if (preset === 'ocean_teal') {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <defs>
          <linearGradient id="tealGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0891B2" />
            <stop offset="100%" stopColor="#06B6D4" />
          </linearGradient>
        </defs>
        <rect width={width} height={height} fill="#F0FDFA" />
        <path d={`M0,${height} L0,${height - 90} Q${width * 0.25},${height - 150} ${width * 0.5},${height - 90} T${width},${height - 90} L${width},${height} Z`} fill="url(#tealGrad)" opacity={0.85} />
        <path d={`M0,0 L${width},0 L${width},70 Q${width * 0.75},110 ${width * 0.5},70 T0,70 Z`} fill="url(#tealGrad)" opacity={0.85} />
        {logoBlock}
        <text x={width / 2} y={contentTop} textAnchor="middle" fontSize="30" fill="#0E7490" fontWeight="bold" letterSpacing="1">{template.certificate_title}</text>
        <text x={width / 2} y={contentTop + 38} textAnchor="middle" fontSize="14" fill="#155E75">{subtitle}</text>
        <text x={width / 2} y={contentTop + 95} textAnchor="middle" fontSize="38" fill="#083344" fontWeight="bold">{data.employeeName}</text>
        {descriptionBlock(contentTop + 120)}
        {signatures('#083344')}
        {qrBox('#0891B2')}
        {certNo('#155E75')}
      </svg>
    );
  }

  if (preset === 'festive_purple') {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ fontFamily: 'Georgia, serif' }}>
        <defs>
          <linearGradient id="purpleGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#C026D3" />
          </linearGradient>
        </defs>
        <rect width={width} height={height} fill="#FDF4FF" />
        <rect x="16" y="16" width={width - 32} height={height - 32} fill="none" stroke="url(#purpleGrad)" strokeWidth="6" />
        <rect x="30" y="30" width={width - 60} height={height - 60} fill="none" stroke="#D4AF37" strokeWidth="1.5" />
        {[[30, 30], [width - 30, 30], [30, height - 30], [width - 30, height - 30]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="12" fill="url(#purpleGrad)" />
        ))}
        {logoBlock}
        <text x={width / 2} y={contentTop} textAnchor="middle" fontSize="30" fill="#7C3AED" fontWeight="bold" letterSpacing="1">{template.certificate_title}</text>
        <text x={width / 2} y={contentTop + 38} textAnchor="middle" fontSize="14" fill="#A21CAF" fontStyle="italic">{subtitle}</text>
        <text x={width / 2} y={contentTop + 95} textAnchor="middle" fontSize="38" fill="#581C87" fontWeight="bold">{data.employeeName}</text>
        <rect x={width / 2 - 90} y={contentTop + 112} width="180" height="4" fill="url(#purpleGrad)" rx="2" />
        {descriptionBlock(contentTop + 135)}
        {signatures('#581C87')}
        {qrBox('#7C3AED')}
        {certNo('#A21CAF')}
      </svg>
    );
  }

  // classic_gold (default)
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ fontFamily: 'Georgia, serif', color: '#3F3F3F' }}>
      <rect width={width} height={height} fill="#FFFDF7" />
      <rect x="20" y="20" width={width - 40} height={height - 40} fill="none" stroke="#B8860B" strokeWidth="5" />
      <rect x="32" y="32" width={width - 64} height={height - 64} fill="none" stroke="#D4AF37" strokeWidth="1.5" />
      {[[32, 32], [width - 32, 32], [32, height - 32], [width - 32, height - 32]].map(([cx, cy], i) => (
        <rect key={i} x={cx - 8} y={cy - 8} width="16" height="16" fill="#D4AF37" transform={`rotate(45 ${cx} ${cy})`} />
      ))}
      {logoBlock}
      <text x={width / 2} y={contentTop - 20} textAnchor="middle" fontSize="13" letterSpacing="4" fill="#B8860B" fontWeight="600">{template.certificate_title}</text>
      <line x1={width / 2 - 100} y1={contentTop} x2={width / 2 + 100} y2={contentTop} stroke="#D4AF37" strokeWidth="1" />
      <text x={width / 2} y={contentTop + 35} textAnchor="middle" fontSize="14" fill="#5B5B5B">{subtitle}</text>
      <text x={width / 2} y={contentTop + 90} textAnchor="middle" fontSize="36" fill="#7A5C00" fontWeight="bold">{data.employeeName}</text>
      <line x1={width / 2 - 160} y1={contentTop + 108} x2={width / 2 + 160} y2={contentTop + 108} stroke="#B8860B" strokeWidth="1.5" />
      {descriptionBlock(contentTop + 130)}
      {signatures()}
      {qrBox()}
      {certNo()}
    </svg>
  );
}

export default CertificateRenderer;
