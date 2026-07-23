import { useNavigate } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { BRAND } from '../../config/branding';
import { login } from '../../services/auth/authService';
import { useAuthorization } from '../../hooks/useAuthorization';
import { loadBranding } from '../../services/branding/brandingService';

interface InputFieldProps {
  id: string;
  label: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  rightElement?: React.ReactNode;
  disabled?: boolean;
  accentColor: string;
}

const InputField: React.FC<InputFieldProps> = ({
  id,
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  rightElement,
  disabled,
  accentColor,
}) => (
  <div>
    <label htmlFor={id} className="block text-xs font-medium text-slate-300 mb-1.5 tracking-wide">
      {label}
    </label>
    <div className="relative">
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={type === 'password' ? 'current-password' : 'off'}
        className="w-full px-4 py-3 pr-11 rounded-xl bg-white/[0.06] border border-white/[0.12] text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ '--tw-ring-color': `${accentColor}66` } as React.CSSProperties}
      />
      {rightElement && (
        <div className="absolute inset-y-0 right-0 flex items-center pr-3.5">{rightElement}</div>
      )}
    </div>
  </div>
);

const EyeIcon: React.FC<{ open: boolean }> = ({ open }) =>
  open ? (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.292 4.338 5.31 7.5 9.966 7.5a10.45 10.45 0 0 0 4.293-.917m3.243-2.158a10.45 10.45 0 0 0 2.564-3.425c-1.292-4.338-5.31-7.5-9.966-7.5a10.45 10.45 0 0 0-4.293.917m7.853 7.853a3 3 0 1 0-4.243-4.243m4.243 4.243L19 19m-7.853-7.853L3 3"
      />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );

export interface LoginFormValues {
  companyCode: string;
  employeeId: string;
  password: string;
  rememberMe: boolean;
}

interface LoginFormProps {
  onSubmit?: (values: LoginFormValues) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSubmit }) => {
  const navigate = useNavigate();
  const { refresh } = useAuthorization();
  const [companyCode, setCompanyCode] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // From the active Theme (Admin → Theme) — falls back to the static
  // default until branding resolves (loadBranding() is cached, so this is
  // a cheap call — LoginPage already triggered the same fetch).
  const [accentColor, setAccentColor] = useState(BRAND.secondaryColor);
  const [baseColor, setBaseColor] = useState(BRAND.primaryColor);

  useEffect(() => {
    loadBranding().then((b) => {
      setAccentColor(b.secondaryColor);
      setBaseColor(b.primaryColor);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("LOGIN BUTTON CLICKED");
    if (loading) return;

    if (!companyCode.trim()) {
      setErrorMessage('Company Code is required.');
      return;
    }
    if (!employeeId.trim()) {
      setErrorMessage('Employee ID is required.');
      return;
    }
    if (!password) {
      setErrorMessage('Password is required.');
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    try {
      onSubmit?.({ companyCode, employeeId, password, rememberMe });

      const result = await login({
  companyCode,
  employeeId,
  password,
});

if (!result.success) {
  setErrorMessage(result.error);
  return;
}

// Reload authorization context after creating session
await refresh();

navigate('/dashboard', { replace: true });
    } catch {
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="backdrop-blur-2xl bg-white/[0.05] border border-white/[0.1] rounded-[24px] shadow-2xl shadow-black/50 p-8 lg:p-10">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-semibold text-white tracking-tight">Sign in</h2>
        <p className="text-sm text-slate-400 mt-1.5">Access your enterprise workspace</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <InputField
          id="companyCode"
          label="Company Code"
          placeholder="Enter company code"
          value={companyCode}
          onChange={(v) => { setCompanyCode(v); setErrorMessage(null); }}
          disabled={loading}
          accentColor={accentColor}
        />

        <InputField
          id="employeeId"
          label="Employee ID"
          placeholder="Enter employee ID"
          value={employeeId}
          onChange={(v) => { setEmployeeId(v); setErrorMessage(null); }}
          disabled={loading}
          accentColor={accentColor}
        />

        <InputField
          id="password"
          label="Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="Enter your password"
          value={password}
          onChange={(v) => { setPassword(v); setErrorMessage(null); }}
          disabled={loading}
          accentColor={accentColor}
          rightElement={
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              disabled={loading}
              className="text-slate-400 hover:opacity-80 transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ color: showPassword ? accentColor : undefined }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <EyeIcon open={showPassword} />
            </button>
          }
        />

        {errorMessage !== null && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
          >
            <svg
              className="mt-0.5 h-4 w-4 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <label htmlFor="rememberMe" className="flex items-center gap-2 cursor-pointer select-none">
            <input
              id="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={loading}
              className="w-4 h-4 rounded border-white/20 bg-white/10 cursor-pointer focus:ring-2 disabled:cursor-not-allowed"
              style={{ accentColor }}
            />
            <span className="text-sm text-slate-300">Remember me</span>
          </label>

          <button
            type="button"
            className="text-sm font-medium hover:opacity-80 transition-opacity duration-200"
            style={{ color: accentColor }}
          >
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-3.5 rounded-xl font-semibold text-sm tracking-wide hover:shadow-lg active:scale-[0.98] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
          style={{
            background: `linear-gradient(to right, ${accentColor}, ${accentColor}CC)`,
            color: baseColor,
          }}
        >
          {loading ? 'Signing In...' : 'Login'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          type="button"
          className="text-sm text-slate-400 hover:text-white transition-colors duration-200"
        >
          Need Help?
        </button>
      </div>

      <p className="mt-4 text-center text-xs text-slate-500 tracking-wide">
        Version {BRAND.version}
      </p>
    </div>
  );
};

export default LoginForm;