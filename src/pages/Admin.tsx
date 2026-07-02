import { useState } from "react";

import Sidebar from "../components/dashboard/Sidebar";
import Header from "../components/dashboard/Header";

import CompanyManagement from "../components/superadmin/CompanyManagement";
import BranchManagement from "../components/superadmin/BranchManagement";
import DepartmentManagement from "../components/superadmin/DepartmentManagement";
import DesignationManagement from "../components/superadmin/DesignationManagement";
import RoleManagement from "../components/superadmin/RoleManagement";
import PermissionManagement from "../components/superadmin/PermissionManagement";
import ThemeManagement from "../components/superadmin/ThemeManagement";
import MenuManagement from "../components/superadmin/MenuManagement";

function Admin() {
  const [activeTab, setActiveTab] = useState("company");

  const getTabClass = (tab: string) =>
    `px-5 py-2 rounded-xl font-semibold transition ${
      activeTab === tab
        ? "bg-yellow-500 text-black shadow"
        : "bg-white text-slate-700 shadow hover:bg-slate-100"
    }`;

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <div className="flex flex-1 flex-col">
        <Header />

        <main className="p-8">
          <h1 className="text-3xl font-bold text-slate-800">
            Super Admin Console
          </h1>

          <p className="mt-2 text-slate-500">
            Configure and manage the complete Learning Management Platform.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => setActiveTab("company")}
              className={getTabClass("company")}
            >
              Company
            </button>

            <button
              onClick={() => setActiveTab("branch")}
              className={getTabClass("branch")}
            >
              Branches
            </button>

            <button
              onClick={() => setActiveTab("department")}
              className={getTabClass("department")}
            >
              Departments
            </button>

            <button
              onClick={() => setActiveTab("designation")}
              className={getTabClass("designation")}
            >
              Designation
            </button>

            <button
              onClick={() => setActiveTab("roles")}
              className={getTabClass("roles")}
            >
              Roles
            </button>

            <button
              onClick={() => setActiveTab("permissions")}
              className={getTabClass("permissions")}
            >
              Permissions
            </button>

            <button
              onClick={() => setActiveTab("theme")}
              className={getTabClass("theme")}
            >
              Theme
            </button>

            <button
              onClick={() => setActiveTab("menu")}
              className={getTabClass("menu")}
            >
              Menu
            </button>
          </div>

          <div className="mt-8">
            {activeTab === "company" && <CompanyManagement />}

            {activeTab === "branch" && <BranchManagement />}

            {activeTab === "department" && <DepartmentManagement />}

            {activeTab === "designation" && <DesignationManagement />}

            {activeTab === "roles" && <RoleManagement />}

            {activeTab === "permissions" && <PermissionManagement />}

            {activeTab === "theme" && <ThemeManagement />}

            {activeTab === "menu" && <MenuManagement />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Admin;