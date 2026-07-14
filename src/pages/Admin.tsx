import { useState } from "react";

// import Sidebar from "../components/dashboard/Sidebar";
// import Header from "../components/dashboard/Header";

import CompanyManagement from "../components/superadmin/CompanyManagement";
import BranchManagement from "../components/superadmin/BranchManagement";
import DepartmentManagement from "../components/superadmin/DepartmentManagement";
import DesignationManagement from "../components/superadmin/DesignationManagement";
import EmployeeManagement from "../components/superadmin/EmployeeManagement";
import CategoryManagement from "../components/superadmin/CategoryManagement";
import CourseManagement from "../components/superadmin/CourseManagement";
import CourseBuilder from "../components/admin/coursebuilder/CourseBuilder";
import RoleManagement from "../components/superadmin/RoleManagement";
import RolePermissionManagement from "../components/superadmin/RolePermissionManagement";
import PermissionManagement from "../components/superadmin/PermissionManagement";
import ThemeManagement from "../components/superadmin/ThemeManagement";
import MenuManagement from "../components/superadmin/MenuManagement";
import MenuPermissionManagement from "../components/superadmin/MenuPermissionManagement";
import ResourceManagement from "../components/superadmin/ResourceManagement";
import AssessmentManagement from "../components/admin/assessment/AssessmentManagement";
import QuestionManagement from "../components/superadmin/QuestionManagement";
import AssessmentAssignmentManagement from "../components/superadmin/AssessmentAssignmentManagement";
import EvaluationRuleManagement from "../components/superadmin/EvaluationRuleManagement";
import AssessmentResultManagement from "../components/superadmin/AssessmentResultManagement";
import CertificateManagement from "../components/superadmin/CertificateManagement";
import CertificateTemplateManagement from "../components/superadmin/CertificateTemplateManagement";
import CertificateGenerationManagement from "../components/superadmin/CertificateGenerationManagement";
import CertificateVerificationManagement from "../components/superadmin/CertificateVerificationManagement";
import LearningPathManagement from "../components/superadmin/LearningPathManagement";
import LearningPathCourseManagement from "../components/superadmin/LearningPathCourseManagement";
import LearningPathEnrollmentManagement from "../components/superadmin/LearningPathEnrollmentManagement";
import LearningPathProgressManagement from "../components/superadmin/LearningPathProgressManagement";
import EnrollmentManagement from "../components/superadmin/EnrollmentManagement";
import TrainingBatchManagement from "../components/superadmin/TrainingBatchManagement";
import EmployeeRoleManagement from "../components/superadmin/EmployeeRoleManagement";
import ReportManagement from "../components/superadmin/ReportManagement";
import TrainerAssignmentManagement from "../components/superadmin/TrainerAssignmentManagement";


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
      <></>

      <div className="flex flex-1 flex-col">
        <></>

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
              Designations
            </button>

            <button
              onClick={() => setActiveTab("employee")}
              className={getTabClass("employee")}
            >
              Employees
            </button>

            <button
              onClick={() => setActiveTab("category")}
              className={getTabClass("category")}
            >
              Categories
            </button>

            <button
              onClick={() => setActiveTab("course")}
              className={getTabClass("course")}
            >
              Courses
            </button>

            <button
              onClick={() => setActiveTab("course-builder")}
              className={getTabClass("course-builder")}
            >
              Course Builder
            </button>
<button
  onClick={() => setActiveTab("resource")}
  className={getTabClass("resource")}
>
  Resources
</button>
<button
  onClick={() => setActiveTab("assessment")}
  className={getTabClass("assessment")}
>
  Assessment
</button>
<button
  onClick={() => setActiveTab("question")}
  className={getTabClass("question")}
>
  Question Bank
</button>
<button
  onClick={() => setActiveTab("assignment")}
  className={getTabClass("assignment")}
>
  Assignments
</button>
<button
  onClick={() => setActiveTab("evaluation")}
  className={getTabClass("evaluation")}
>
  Evaluation Rules
</button>
<button
  onClick={() => setActiveTab("results")}
  className={getTabClass("results")}
>
  Results
</button>
<button
  onClick={() => setActiveTab("certificate")}
  className={getTabClass("certificate")}
>
  Certificates
</button>
<button
  onClick={() => setActiveTab("certificate-template")}
  className={getTabClass("certificate-template")}
>
  Certificate Templates
</button>
<button
  onClick={() => setActiveTab("certificate-generation")}
  className={getTabClass("certificate-generation")}
>
  Certificate Queue
</button>
<button
  onClick={() => setActiveTab("certificate-verification")}
  className={getTabClass("certificate-verification")}
>
  Certificate Verification
</button>
<button
  onClick={() => setActiveTab("learning-path")}
  className={getTabClass("learning-path")}
>
  Learning Paths
</button>
<button
  onClick={() => setActiveTab("learning-path-course")}
  className={getTabClass("learning-path-course")}
>
  Learning Path Courses
</button>
<button
  onClick={() => setActiveTab("learning-path-enrollment")}
  className={getTabClass("learning-path-enrollment")}
>
  Learning Path Enrollments
</button>
<button
  onClick={() => setActiveTab("learning-path-progress")}
  className={getTabClass("learning-path-progress")}
>
  Learning Path Progress
</button>
<button
  onClick={() => setActiveTab("enrollment")}
  className={getTabClass("enrollment")}
>
  Enrollments
</button>
<button
  onClick={() => setActiveTab("training-batch")}
  className={getTabClass("training-batch")}
>
  Training Batches
</button>
<button
  onClick={() => setActiveTab("trainer-assignment")}
  className={getTabClass("trainer-assignment")}
>
  Trainer Assignments
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
  onClick={() => setActiveTab("settings")}
  className={getTabClass("settings")}
>
  Settings
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

            {activeTab === "employee" && <EmployeeManagement />}

            {activeTab === "category" && <CategoryManagement />}

            {activeTab === "course" && <CourseManagement />}

            {activeTab === "course-builder" && <CourseBuilder />}
            {activeTab === "resource" && <ResourceManagement />}
            {activeTab === "assessment" && <AssessmentManagement />}
            {activeTab === "question" && <QuestionManagement />}
            {activeTab === "assignment" && <AssessmentAssignmentManagement />}
            {activeTab === "evaluation" && <EvaluationRuleManagement />}
            {activeTab === "results" && <AssessmentResultManagement />}
            {activeTab === "certificate" && <CertificateManagement />}
            {activeTab === "evaluation" && <EvaluationRuleManagement />}

{activeTab === "results" && <AssessmentResultManagement />}

{activeTab === "certificate" && <CertificateManagement />}

{activeTab === "certificate-template" && (
  <CertificateTemplateManagement />
)}

{activeTab === "certificate-generation" && (
  <CertificateGenerationManagement />
)}
{activeTab === "certificate-verification" && (
  <CertificateVerificationManagement />
)}
{activeTab === "learning-path" && (
  <LearningPathManagement />
)}
{activeTab === "learning-path-course" && (
  <LearningPathCourseManagement />
)}
{activeTab === "learning-path-enrollment" && (
  <LearningPathEnrollmentManagement />
)}
{activeTab === "learning-path-progress" && (
  <LearningPathProgressManagement />
)}
{activeTab === "enrollment" && (
  <EnrollmentManagement />
)}
{activeTab === "training-batch" && (
  <TrainingBatchManagement />
)}
{activeTab === "trainer-assignment" && (
  <TrainerAssignmentManagement />
)}
{activeTab === "employee-role" && <EmployeeRoleManagement />}

{activeTab === "roles" && <RoleManagement />}
{activeTab === "reports" && <ReportManagement />}

{activeTab === "permissions" && <PermissionManagement />}

            {activeTab === "roles" && <RoleManagement />}

            {activeTab === "permissions" && <PermissionManagement />}
            {activeTab==="role-permission" && (
<RolePermissionManagement/>
)}


            {activeTab === "theme" && <ThemeManagement />}

            {activeTab === "menu" && <MenuManagement />}
            {activeTab === "menu-permission" && <MenuPermissionManagement />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Admin;