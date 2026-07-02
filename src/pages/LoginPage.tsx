import React from 'react';
import { BRAND } from '../config/branding';
import logo from '../assets/logo.png';
import LoginForm from '../components/auth/LoginForm';

const FeatureIcon: React.FC<{ index: number }> = ({ index }) => {
  const icons = [
    <path
      key="icon-0"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 6.04C10.21 4.36 7.5 3.5 5 3.5c-.7 0-1.38.07-2 .2v13.3c.62-.13 1.3-.2 2-.2 2.5 0 5.21.86 7 2.54m0-13.3c1.79-1.68 4.5-2.54 7-2.54.7 0 1.38.07 2 .2v13.3c-.62-.13-1.3-.2-2-.2-2.5 0-5.21.86-7 2.54m0-13.3v13.3"
    />,
    <path
      key="icon-1"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 13.5 8.25 8.25l4.5 4.5L21 4.5M21 4.5h-5.25M21 4.5v5.25M3 19.5h18"
    />,
    <path
      key="icon-2"
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 21h18M6 21V10.5l3-3 3 3 3-3 3 3V21M9 21v-5h3v5"
    />,
  ];

  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      {icons[index % icons.length]}
    </svg>
  );
};

const FeatureCard: React.FC<{ title: string; description: string; index: number }> = ({
  title,
  description,
  index,
}) => (
  <div className="group flex items-start gap-4 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.07] transition-all duration-300 cursor-default">
    <div
      className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center group-hover:scale-105 transition-all duration-300"
      style={{
        backgroundColor: `${BRAND.secondaryColor}1A`,
        border: `1px solid ${BRAND.secondaryColor}33`,
        color: BRAND.secondaryColor,
      }}
    >
      <FeatureIcon index={index} />
    </div>
    <div>
      <h3 className="text-white font-medium text-sm tracking-wide">{title}</h3>
      <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{description}</p>
    </div>
  </div>
);

export const LoginPage: React.FC = () => {
  return (
    <div
      className="min-h-screen w-full flex flex-col md:flex-row font-sans"
      style={{ backgroundColor: BRAND.primaryColor }}
    >
      {/* LEFT SIDE */}
      <div
        className="relative w-full md:w-1/2 min-h-[40vh] md:min-h-screen flex flex-col items-center justify-center px-8 lg:px-16 py-16 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, ${BRAND.primaryColor}, ${BRAND.primaryColor}E6, ${BRAND.primaryColor}CC)`,
        }}
      >
        <div
          className="absolute -top-32 -right-32 w-96 h-96 rounded-full blur-3xl"
          style={{ backgroundColor: `${BRAND.secondaryColor}12` }}
        />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-blue-600/[0.08] blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, ${BRAND.secondaryColor} 1px, transparent 1px), radial-gradient(circle at 75% 75%, ${BRAND.secondaryColor} 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />

        <div className="relative z-10 w-full max-w-md flex flex-col items-center text-center">
          <div className="mb-7">
            <img
              src={logo}
              alt={BRAND.companyName}
              className="h-36 w-36 object-contain"
              style={{ boxShadow: `0 0 0 1px ${BRAND.secondaryColor}4D` }}
            />
          </div>

          <h1 className="text-4xl lg:text-5xl font-bold text-white tracking-tight whitespace-nowrap">
            {BRAND.companyName}
          </h1>

          <p
            className="mt-3 text-sm lg:text-base font-light tracking-wide"
            style={{ color: BRAND.secondaryColor }}
          >
            {BRAND.tagline}
          </p>

          <div
            className="w-14 h-px my-8"
            style={{
              background: `linear-gradient(to right, transparent, ${BRAND.secondaryColor}99, transparent)`,
            }}
          />

          <div className="w-full flex flex-col gap-3">
            {BRAND.features.map((feature, index) => (
              <FeatureCard
                key={feature.title}
                title={feature.title}
                description={feature.description}
                index={index}
              />
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="relative w-full md:w-1/2 flex-1 flex flex-col items-center justify-center px-6 py-12 bg-[#0D1320]">
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: `radial-gradient(circle at 70% 30%, ${BRAND.secondaryColor} 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 w-full max-w-md">
          <LoginForm />
        </div>
      </div>
    </div>
  );
};

export default LoginPage;