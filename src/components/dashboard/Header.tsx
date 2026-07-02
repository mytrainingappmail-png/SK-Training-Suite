import { BRAND } from "../../config/branding";

function Header() {
  return (
    <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8">

      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          Dashboard
        </h1>

        <p className="text-sm text-slate-500">
          Welcome to {BRAND.companyName}
        </p>
      </div>

      <div className="flex items-center gap-4">

        <button className="relative p-2 rounded-xl hover:bg-slate-100 transition">
          🔔
        </button>

        <div className="flex items-center gap-3">

          <div className="w-11 h-11 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold">
            A
          </div>

          <div className="text-right">
            <h3 className="text-sm font-semibold text-slate-800">
              Admin
            </h3>

            <p className="text-xs text-slate-500">
              Super Administrator
            </p>
          </div>

        </div>

      </div>

    </header>
  );
}

export default Header;