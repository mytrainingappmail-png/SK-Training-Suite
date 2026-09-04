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

      <div className="flex-1 flex flex-col print:block">

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
