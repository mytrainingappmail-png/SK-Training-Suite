import Sidebar from "../components/dashboard/Sidebar";
import Header from "../components/dashboard/Header";
import DashboardCards from "../components/dashboard/DashboardCards";
import QuickActions from "../components/dashboard/QuickActions";
import RecentActivity from "../components/dashboard/RecentActivity";

function Dashboard() {
  return (
    <div className="flex min-h-screen bg-slate-100">

      <Sidebar />

      <div className="flex-1 flex flex-col">

        <Header />

        <main className="p-8 space-y-8 overflow-y-auto">

          <DashboardCards />

          <QuickActions />

          <RecentActivity />

        </main>

      </div>

    </div>
  );
}

export default Dashboard;