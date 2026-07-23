import { useState } from "react";
import { useLocation } from "react-router-dom";

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
import ThemeManagement from "../components/superadmin/ThemeManagement";
import MenuManagement from "../components/superadmin/MenuManagement";
import SettingsManagement from "../components/settings/SettingsManagement";
import PermissionManagement from "../modules/permissions/PermissionManagement";
import PermissionMatrix from "../modules/permissions/PermissionMatrix";
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

import PlanManagement from "../modules/license/PlanManagement";
import CompanyLicenseManagement from "../modules/license/CompanyLicenseManagement";
import DiscountCodeManagement from "../modules/license/DiscountCodeManagement";
import NotificationLog from "../modules/license/NotificationLog";
import PaymentSettingsManagement from "../modules/payment/PaymentSettingsManagement";
import CourseVisibilityMatrix from "../modules/courseVisibility/CourseVisibilityMatrix";
import RealEstateProjectManagement from "../modules/realEstateProject/RealEstateProjectManagement";
import VideoLibraryManagement from "../modules/videoLibraryContent/VideoLibraryManagement";
import BulkCertificateIssue from "../modules/certificate/BulkCertificateIssue";
import AttendanceManagement from "../modules/attendance/AttendanceManagement";
import SecurityMigration from "../modules/security/SecurityMigration";
import GeofenceManagement from "../modules/geofence/GeofenceManagement";
import NotificationCenter from "../components/admin/notifications/NotificationCenter";

import { useAuthorization } from "../hooks/useAuthorization";

function Admin() {
  const location = useLocation();
  const requestedTab = (location.state as { tab?: string; courseId?: string } | null)?.tab;
  const requestedCourseId = (location.state as { tab?: string; courseId?: string } | null)?.courseId;
  const [activeTab, setActiveTab] = useState(requestedTab || "company");
  const { can, PERMISSIONS } = useAuthorization();
  const [search, setSearch] = useState("");

  const getTabClass = (tab: string) =>
    `px-5 py-2 rounded-xl font-semibold transition ${
      activeTab === tab
        ? "bg-yellow-500 text-black shadow"
        : "bg-white text-slate-700 shadow hover:bg-slate-100"
    }`;

  const kw = search.trim().toLowerCase();
  const matches = (label: string) => !kw || label.toLowerCase().includes(kw);

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

          <div className="mt-6">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search modules…"
              className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400/30"
            />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {can(PERMISSIONS.VIEW_COMPANY) && matches("Company") && (
              <button
                onClick={() => setActiveTab("company")}
                className={getTabClass("company")}
              >
                Company
              </button>
            )}

            {can(PERMISSIONS.VIEW_BRANCH) && matches("Branches") && (
              <button
                onClick={() => setActiveTab("branch")}
                className={getTabClass("branch")}
              >
                Branches
              </button>
            )}

            {can(PERMISSIONS.VIEW_DEPARTMENT) && matches("Departments") && (
              <button
                onClick={() => setActiveTab("department")}
                className={getTabClass("department")}
              >
                Departments
              </button>
            )}

            {can(PERMISSIONS.VIEW_DESIGNATION) && matches("Designations") && (
              <button
                onClick={() => setActiveTab("designation")}
                className={getTabClass("designation")}
              >
                Designations
              </button>
            )}

            {can(PERMISSIONS.VIEW_EMPLOYEE) && matches("Employees") && (
              <button
                onClick={() => setActiveTab("employee")}
                className={getTabClass("employee")}
              >
                Employees
              </button>
            )}

            {can(PERMISSIONS.VIEW_CATEGORY) && matches("Categories") && (
              <button
                onClick={() => setActiveTab("category")}
                className={getTabClass("category")}
              >
                Categories
              </button>
            )}

            {can(PERMISSIONS.VIEW_COURSE) && matches("Courses") && (
              <button
                onClick={() => setActiveTab("course")}
                className={getTabClass("course")}
              >
                Courses
              </button>
            )}

            {can(PERMISSIONS.VIEW_COURSE) && matches("Course Builder") && (
              <button
                onClick={() => setActiveTab("course-builder")}
                className={getTabClass("course-builder")}
              >
                Course Builder
              </button>
            )}

            {can(PERMISSIONS.VIEW_RESOURCE) && matches("Resources") && (
              <button
                onClick={() => setActiveTab("resource")}
                className={getTabClass("resource")}
              >
                Resources
              </button>
            )}

            {can(PERMISSIONS.VIEW_ASSESSMENT) && matches("Assessment") && (
              <button
                onClick={() => setActiveTab("assessment")}
                className={getTabClass("assessment")}
              >
                Assessment
              </button>
            )}

            {can(PERMISSIONS.VIEW_QUESTION_BANK) && matches("Question Bank") && (
              <button
                onClick={() => setActiveTab("question")}
                className={getTabClass("question")}
              >
                Question Bank
              </button>
            )}

            {can(PERMISSIONS.VIEW_ASSIGNMENT) && matches("Assignments") && (
              <button
                onClick={() => setActiveTab("assignment")}
                className={getTabClass("assignment")}
              >
                Assignments
              </button>
            )}

            {can(PERMISSIONS.VIEW_EVALUATION_RULE) && matches("Evaluation Rules") && (
              <button
                onClick={() => setActiveTab("evaluation")}
                className={getTabClass("evaluation")}
              >
                Evaluation Rules
              </button>
            )}

            {can(PERMISSIONS.VIEW_ASSESSMENT_RESULT) && matches("Results") && (
              <button
                onClick={() => setActiveTab("results")}
                className={getTabClass("results")}
              >
                Results
              </button>
            )}

            {can(PERMISSIONS.VIEW_CERTIFICATE) && matches("Certificates") && (
              <button
                onClick={() => setActiveTab("certificate")}
                className={getTabClass("certificate")}
              >
                Certificates
              </button>
            )}

            {can(PERMISSIONS.VIEW_CERT_TEMPLATE) && matches("Certificate Templates") && (
              <button
                onClick={() => setActiveTab("certificate-template")}
                className={getTabClass("certificate-template")}
              >
                Certificate Templates
              </button>
            )}

            {can(PERMISSIONS.VIEW_CERT_QUEUE) && matches("Certificate Queue") && (
              <button
                onClick={() => setActiveTab("certificate-generation")}
                className={getTabClass("certificate-generation")}
              >
                Certificate Queue
              </button>
            )}

            {can(PERMISSIONS.VIEW_CERT_VERIFICATION) && matches("Certificate Verification") && (
              <button
                onClick={() => setActiveTab("certificate-verification")}
                className={getTabClass("certificate-verification")}
              >
                Certificate Verification
              </button>
            )}

            {can(PERMISSIONS.VIEW_LEARNING_PATH) && matches("Learning Paths") && (
              <button
                onClick={() => setActiveTab("learning-path")}
                className={getTabClass("learning-path")}
              >
                Learning Paths
              </button>
            )}

            {can(PERMISSIONS.VIEW_LP_COURSE) && matches("Learning Path Courses") && (
              <button
                onClick={() => setActiveTab("learning-path-course")}
                className={getTabClass("learning-path-course")}
              >
                Learning Path Courses
              </button>
            )}

            {can(PERMISSIONS.VIEW_LP_ENROLLMENT) && matches("Learning Path Enrollments") && (
              <button
                onClick={() => setActiveTab("learning-path-enrollment")}
                className={getTabClass("learning-path-enrollment")}
              >
                Learning Path Enrollments
              </button>
            )}

            {can(PERMISSIONS.VIEW_LP_PROGRESS) && matches("Learning Path Progress") && (
              <button
                onClick={() => setActiveTab("learning-path-progress")}
                className={getTabClass("learning-path-progress")}
              >
                Learning Path Progress
              </button>
            )}

            {can(PERMISSIONS.VIEW_ENROLLMENT) && matches("Enrollments") && (
              <button
                onClick={() => setActiveTab("enrollment")}
                className={getTabClass("enrollment")}
              >
                Enrollments
              </button>
            )}

            {can(PERMISSIONS.VIEW_TRAINING_BATCH) && matches("Training Batches") && (
              <button
                onClick={() => setActiveTab("training-batch")}
                className={getTabClass("training-batch")}
              >
                Training Batches
              </button>
            )}

            {can(PERMISSIONS.VIEW_TRAINER_ASSIGNMENT) && matches("Trainer Assignments") && (
              <button
                onClick={() => setActiveTab("trainer-assignment")}
                className={getTabClass("trainer-assignment")}
              >
                Trainer Assignments
              </button>
            )}

            {can(PERMISSIONS.VIEW_ROLE) && matches("Roles") && (
              <button
                onClick={() => setActiveTab("roles")}
                className={getTabClass("roles")}
              >
                Roles
              </button>
            )}

            {can(PERMISSIONS.VIEW_EMPLOYEE_ROLE) && matches("Employee Roles") && (
              <button
                onClick={() => setActiveTab("employee-role")}
                className={getTabClass("employee-role")}
              >
                Employee Roles
              </button>
            )}

            {can(PERMISSIONS.VIEW_PERMISSION) && matches("Permissions") && (
              <button
                onClick={() => setActiveTab("permissions")}
                className={getTabClass("permissions")}
              >
                Permissions
              </button>
            )}

            {can(PERMISSIONS.VIEW_PERMISSION) && matches("Permission Matrix") && (
              <button
                onClick={() => setActiveTab("role-permission")}
                className={getTabClass("role-permission")}
              >
                Permission Matrix
              </button>
            )}

            {can(PERMISSIONS.VIEW_THEME) && matches("Theme") && (
              <button
                onClick={() => setActiveTab("theme")}
                className={getTabClass("theme")}
              >
                Theme
              </button>
            )}

            {can(PERMISSIONS.VIEW_SETTINGS) && matches("Settings") && (
              <button
                onClick={() => setActiveTab("settings")}
                className={getTabClass("settings")}
              >
                Settings
              </button>
            )}

            {can(PERMISSIONS.VIEW_MENU) && matches("Menu") && (
              <button
                onClick={() => setActiveTab("menu")}
                className={getTabClass("menu")}
              >
                Menu
              </button>
            )}

            {can(PERMISSIONS.VIEW_REPORTS) && matches("Reports") && (
              <button
                onClick={() => setActiveTab("reports")}
                className={getTabClass("reports")}
              >
                Reports
              </button>
            )}

            {matches("Notifications") && (
              <button
                onClick={() => setActiveTab("notifications")}
                className={getTabClass("notifications")}
              >
                Notifications
              </button>
            )}

            {matches("Plans") && (
              <button
                onClick={() => setActiveTab("plans")}
                className={getTabClass("plans")}
              >
                Plans
              </button>
            )}

            {matches("Company Licenses") && (
              <button
                onClick={() => setActiveTab("company-license")}
                className={getTabClass("company-license")}
              >
                Company Licenses
              </button>
            )}

            {matches("Discount Codes") && (
              <button
                onClick={() => setActiveTab("discount-codes")}
                className={getTabClass("discount-codes")}
              >
                Discount Codes
              </button>
            )}

            {matches("License Notifications") && (
              <button
                onClick={() => setActiveTab("license-notifications")}
                className={getTabClass("license-notifications")}
              >
                License Notifications
              </button>
            )}

            {matches("Payment Settings") && (
              <button
                onClick={() => setActiveTab("payment-settings")}
                className={getTabClass("payment-settings")}
              >
                Payment Settings
              </button>
            )}

            {matches("Course Visibility") && (
              <button
                onClick={() => setActiveTab("course-visibility")}
                className={getTabClass("course-visibility")}
              >
                Course Visibility
              </button>
            )}

            {matches("Projects") && (
              <button
                onClick={() => setActiveTab("real-estate-projects")}
                className={getTabClass("real-estate-projects")}
              >
                Projects
              </button>
            )}

            {matches("Video Library") && (
              <button
                onClick={() => setActiveTab("video-library-content")}
                className={getTabClass("video-library-content")}
              >
                Video Library
              </button>
            )}

            {matches("Bulk Certificate Issue") && (
              <button
                onClick={() => setActiveTab("bulk-certificate-issue")}
                className={getTabClass("bulk-certificate-issue")}
              >
                Bulk Certificate Issue
              </button>
            )}

            {matches("Attendance") && (
              <button
                onClick={() => setActiveTab("attendance")}
                className={getTabClass("attendance")}
              >
                Attendance
              </button>
            )}

            {matches("Secure Login Migration") && (
              <button
                onClick={() => setActiveTab("security-migration")}
                className={getTabClass("security-migration")}
              >
                Secure Login Migration
              </button>
            )}

            {matches("Attendance Geofencing") && (
              <button
                onClick={() => setActiveTab("geofence")}
                className={getTabClass("geofence")}
              >
                Attendance Geofencing
              </button>
            )}
          </div>

          <div className="mt-8">
            {activeTab === "company" && can(PERMISSIONS.VIEW_COMPANY) && <CompanyManagement />}

            {activeTab === "branch" && can(PERMISSIONS.VIEW_BRANCH) && <BranchManagement />}

            {activeTab === "department" && can(PERMISSIONS.VIEW_DEPARTMENT) && <DepartmentManagement />}

            {activeTab === "designation" && can(PERMISSIONS.VIEW_DESIGNATION) && <DesignationManagement />}

            {activeTab === "roles" && can(PERMISSIONS.VIEW_ROLE) && <RoleManagement />}

            {activeTab === "employee" && can(PERMISSIONS.VIEW_EMPLOYEE) && <EmployeeManagement />}

            {activeTab === "category" && can(PERMISSIONS.VIEW_CATEGORY) && <CategoryManagement />}

            {activeTab === "course" && can(PERMISSIONS.VIEW_COURSE) && <CourseManagement />}

            {activeTab === "course-builder" && can(PERMISSIONS.VIEW_COURSE) && <CourseBuilder initialCourseId={requestedCourseId} />}
            {activeTab === "resource" && can(PERMISSIONS.VIEW_RESOURCE) && <ResourceManagement />}
            {activeTab === "assessment" && can(PERMISSIONS.VIEW_ASSESSMENT) && <AssessmentManagement />}
            {activeTab === "question" && can(PERMISSIONS.VIEW_QUESTION_BANK) && <QuestionManagement />}
            {activeTab === "assignment" && can(PERMISSIONS.VIEW_ASSIGNMENT) && <AssessmentAssignmentManagement />}
            {activeTab === "evaluation" && can(PERMISSIONS.VIEW_EVALUATION_RULE) && <EvaluationRuleManagement />}
            {activeTab === "results" && can(PERMISSIONS.VIEW_ASSESSMENT_RESULT) && <AssessmentResultManagement />}
            {activeTab === "certificate" && can(PERMISSIONS.VIEW_CERTIFICATE) && <CertificateManagement />}

            {activeTab === "certificate-template" && can(PERMISSIONS.VIEW_CERT_TEMPLATE) && (
              <CertificateTemplateManagement />
            )}

            {activeTab === "certificate-generation" && can(PERMISSIONS.VIEW_CERT_QUEUE) && (
              <CertificateGenerationManagement />
            )}
            {activeTab === "certificate-verification" && can(PERMISSIONS.VIEW_CERT_VERIFICATION) && (
              <CertificateVerificationManagement />
            )}
            {activeTab === "learning-path" && can(PERMISSIONS.VIEW_LEARNING_PATH) && (
              <LearningPathManagement />
            )}
            {activeTab === "learning-path-course" && can(PERMISSIONS.VIEW_LP_COURSE) && (
              <LearningPathCourseManagement />
            )}
            {activeTab === "learning-path-enrollment" && can(PERMISSIONS.VIEW_LP_ENROLLMENT) && (
              <LearningPathEnrollmentManagement />
            )}
            {activeTab === "learning-path-progress" && can(PERMISSIONS.VIEW_LP_PROGRESS) && (
              <LearningPathProgressManagement />
            )}
            {activeTab === "enrollment" && can(PERMISSIONS.VIEW_ENROLLMENT) && (
              <EnrollmentManagement />
            )}
            {activeTab === "training-batch" && can(PERMISSIONS.VIEW_TRAINING_BATCH) && (
              <TrainingBatchManagement />
            )}
            {activeTab === "trainer-assignment" && can(PERMISSIONS.VIEW_TRAINER_ASSIGNMENT) && (
              <TrainerAssignmentManagement />
            )}
            {activeTab === "employee-role" && can(PERMISSIONS.VIEW_EMPLOYEE_ROLE) && <EmployeeRoleManagement />}

            {activeTab === "reports" && can(PERMISSIONS.VIEW_REPORTS) && <ReportManagement />}

            {activeTab === "notifications" && <NotificationCenter />}

            {activeTab === "permissions" && can(PERMISSIONS.VIEW_PERMISSION) && <PermissionManagement />}
            {activeTab === "role-permission" && can(PERMISSIONS.VIEW_PERMISSION) && (
              <PermissionMatrix />
            )}

            {activeTab === "theme" && can(PERMISSIONS.VIEW_THEME) && <ThemeManagement />}

            {activeTab === "settings" && can(PERMISSIONS.VIEW_SETTINGS) && <SettingsManagement />}

            {activeTab === "menu" && can(PERMISSIONS.VIEW_MENU) && <MenuManagement />}

            {activeTab === "plans" && <PlanManagement />}

            {activeTab === "company-license" && <CompanyLicenseManagement />}

            {activeTab === "discount-codes" && <DiscountCodeManagement />}

            {activeTab === "license-notifications" && <NotificationLog />}

            {activeTab === "payment-settings" && <PaymentSettingsManagement />}

            {activeTab === "course-visibility" && <CourseVisibilityMatrix />}

            {activeTab === "real-estate-projects" && <RealEstateProjectManagement />}

            {activeTab === "video-library-content" && <VideoLibraryManagement />}

            {activeTab === "bulk-certificate-issue" && <BulkCertificateIssue />}

            {activeTab === "attendance" && <AttendanceManagement />}

            {activeTab === "security-migration" && <SecurityMigration />}

            {activeTab === "geofence" && <GeofenceManagement />}
          </div>
        </main>
      </div>
    </div>
  );
}

export default Admin;
