import { useState } from "react";

// A password box with an eye button: what is being typed can be shown or hidden. (A password that is already saved
// cannot be shown by anyone - it is stored scrambled - only the text typed into the box can be revealed.)
const EyeIcon: React.FC<{ open: boolean }> = ({ open }) =>
  open ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.292 4.338 5.31 7.5 9.966 7.5a10.45 10.45 0 0 0 4.293-.917m3.243-2.158a10.45 10.45 0 0 0 2.564-3.425c-1.292-4.338-5.31-7.5-9.966-7.5a10.45 10.45 0 0 0-4.293.917m7.853 7.853a3 3 0 1 0-4.243-4.243m4.243 4.243L19 19m-7.853-7.853L3 3"
      />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );

export default function PasswordField({
  value, onChange, placeholder, autoComplete,
}: { value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        className="w-full rounded-lg bg-slate-800 border border-slate-700 pl-3 pr-10 py-2 text-sm text-white outline-none focus:border-violet-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
        aria-label={show ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        <EyeIcon open={show} />
      </button>
    </div>
  );
}
