import { Outlet } from "react-router-dom";

import Sidebar from "../components/dashboard/Sidebar";
import Header from "../components/dashboard/Header";
import Footer from "../components/dashboard/Footer";
import LicenseGuard from "../components/license/LicenseGuard";
import HelpBotWidget from "../components/help/HelpBotWidget";

function AppLayout() {
  return (
    <div className="flex min-h-screen bg-slate-100 print:block">

      <Sidebar />

      {/* min-w-0 is required here: without it, a flex child's default
          min-width:auto lets ANY unshrinkable-wide descendant (e.g. a
          horizontally-scrolling tab bar with flex-shrink-0 items) push
          this column — and the real viewport with it — wider than the
          screen, defeating that descendant's own overflow-x-auto and
          breaking mobile layout. Purely defensive; no effect when nothing
          this wide exists. */}
      <div className="flex-1 flex flex-col min-w-0 print:block">

        <Header />

        <main className="flex-1 overflow-y-auto p-8 print:overflow-visible print:p-0">
          <LicenseGuard>
            <Outlet />
          </LicenseGuard>
        </main>

        <Footer />

      </div>

      <HelpBotWidget />

    </div>
  );
}

export default AppLayout;
