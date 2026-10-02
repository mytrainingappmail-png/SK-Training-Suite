// The company logo shown in the sidebar and on the login page.
//
// It never falls back to a picture of ANOTHER business. While the company's own logo is still being
// fetched there is simply an empty box (no flash of the old bundled "SK" logo on every page load),
// and a company that has not uploaded a logo gets its initial in a neutral badge.

interface BrandLogoProps {
  /** The company's logo URL, '' if it has none (or it has not arrived yet). */
  src: string;
  /** False while the branding request is still in flight. */
  ready: boolean;
  name: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function BrandLogo({ src, ready, name, className = '', style }: BrandLogoProps) {
  if (src) return <img src={src} alt={name} className={className} style={style} />;
  const initial = (name.trim()[0] ?? 'R').toUpperCase();
  return (
    <div
      aria-label={name}
      className={`flex items-center justify-center bg-white font-bold text-slate-700 ${className}`}
      style={{ ...style, opacity: ready ? 1 : 0 }}
    >
      <span style={{ fontSize: '40%' }}>{initial}</span>
    </div>
  );
}
