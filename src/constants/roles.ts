import { PERMISSIONS } from "./permissions";

export interface Role {
  id: string;
  name: string;
  level: number;
  permissions: string[];
}

export const DEFAULT_ROLES: Role[] = [
  {
    id: "super_admin",
    name: "Super Admin",
    level: 1,
    permissions: Object.values(PERMISSIONS),
  },

  {
    id: "admin",
    name: "Admin",
    level: 2,
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_EMPLOYEE,
      PERMISSIONS.CREATE_EMPLOYEE,
      PERMISSIONS.EDIT_EMPLOYEE,
      PERMISSIONS.VIEW_COURSE,
      PERMISSIONS.CREATE_COURSE,
      PERMISSIONS.EDIT_COURSE,
      PERMISSIONS.VIEW_ASSESSMENT,
      PERMISSIONS.CREATE_ASSESSMENT,
      PERMISSIONS.VIEW_REPORTS,
      PERMISSIONS.VIEW_SETTINGS,
    ],
  },

  {
    id: "trainer",
    name: "Trainer",
    level: 3,
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_COURSE,
      PERMISSIONS.EDIT_COURSE,
      PERMISSIONS.VIEW_MODULE,
      PERMISSIONS.CREATE_MODULE,
      PERMISSIONS.EDIT_MODULE,
      PERMISSIONS.VIEW_LESSON,
      PERMISSIONS.CREATE_LESSON,
      PERMISSIONS.EDIT_LESSON,
      PERMISSIONS.VIEW_ASSESSMENT,
      PERMISSIONS.CREATE_ASSESSMENT,
    ],
  },

  {
    id: "learner",
    name: "Learner",
    level: 4,
    permissions: [
      PERMISSIONS.VIEW_DASHBOARD,
      PERMISSIONS.VIEW_COURSE,
      PERMISSIONS.VIEW_MODULE,
      PERMISSIONS.VIEW_LESSON,
      PERMISSIONS.VIEW_ASSESSMENT,
      PERMISSIONS.VIEW_CERTIFICATE,
    ],
  },
];