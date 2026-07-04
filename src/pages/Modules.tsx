import Header from "../components/dashboard/Header";
import Sidebar from "../components/dashboard/Sidebar";
import ModuleManagement from "../components/superadmin/ModuleManagement";

function Modules() {
  return (
    <div className="flex min-h-screen bg-slate-100">

      <Sidebar />

      <div className="flex-1 flex flex-col">

        <Header />

        <main className="p-8">
          <ModuleManagement />
        </main>

      </div>

    </div>
  );
}

export default Modules;
