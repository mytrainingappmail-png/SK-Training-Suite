import { Outlet } from "react-router-dom";

import Sidebar from "../components/dashboard/Sidebar";
import Header from "../components/dashboard/Header";
import Footer from "../components/dashboard/Footer";
import LicenseGuard from "../components/license/LicenseGuard";

function AppLayout() {
  return (
    <div className="flex min-h-screen bg-slate-100">

      <Sidebar />

      <div className="flex-1 flex flex-col">

        <Header />

        <main className="flex-1 overflow-y-auto p-8">
          <LicenseGuard>
            <Outlet />
          </LicenseGuard>
        </main>

        <Footer />

      </div>

    </div>
  );
}

export default AppLayout;
