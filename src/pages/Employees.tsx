import Header from "../components/dashboard/Header";
import Sidebar from "../components/dashboard/Sidebar";
import EmployeeManagement from "../components/superadmin/EmployeeManagement";

function Employees() {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <Header />

        <main className="p-8">
          <EmployeeManagement />
        </main>
      </div>
    </div>
  );
}

export default Employees;