import { BRAND } from "../../config/branding";
import { MENU } from "../../config/menu";
import { Link } from "react-router-dom";


function Sidebar() {
  return (
    <aside className="w-72 h-screen bg-slate-900 border-r border-slate-800 flex flex-col">

      <div className="p-6 border-b border-slate-800 flex items-center gap-3">

        <img
          src={BRAND.logo}
          alt="logo"
          className="w-12 h-12 rounded-xl object-contain bg-white"
        />

        <div>
          <h2 className="text-white font-semibold">
            {BRAND.companyName}
          </h2>

          <p className="text-slate-400 text-xs">
            Training Suite
          </p>
        </div>

      </div>

      <nav className="flex-1 p-4">

        {MENU
  .filter((item) => item.visible)
  .map((item) => (
    <Link
      key={item.id}
      to={item.route}
      className="block w-full mb-2 px-4 py-3 rounded-xl text-slate-300 hover:bg-yellow-500 hover:text-black transition"
    >
      {item.title}
    </Link>
  ))}
      </nav>

    </aside>
  );
}

export default Sidebar;