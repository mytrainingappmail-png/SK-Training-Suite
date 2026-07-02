/* =====================================================
   SK ENTERPRISE LMS
   MASTER APPLICATION TYPES
   ===================================================== */

export type UserStatus =
  | "active"
  | "inactive"
  | "blocked";

export type ThemeMode =
  | "light"
  | "dark"
  | "auto";

export interface Company {

  id: string;

  name: string;

  shortName: string;

  logo: string;

  website: string;

  email: string;

  phone: string;

  theme: ThemeMode;

  active: boolean;

}

export interface Branch {

  id: string;

  companyId: string;

  name: string;

  code: string;

  city: string;

  state: string;

  country: string;

  active: boolean;

}

export interface Department {

  id: string;

  companyId: string;

  name: string;

  active: boolean;

}

export interface Designation {

  id: string;

  departmentId: string;

  title: string;

  active: boolean;

}

export interface Role {

  id: string;

  name: string;

  description: string;

  active: boolean;

}

export interface Permission {

  id: string;

  module: string;

  create: boolean;

  read: boolean;

  update: boolean;

  delete: boolean;

}

export interface User {

  id: string;

  employeeId: string;

  companyId: string;

  branchId: string;

  departmentId: string;

  designationId: string;

  roleId: string;

  firstName: string;

  lastName: string;

  email: string;

  mobile: string;

  profileImage: string;

  status: UserStatus;

}