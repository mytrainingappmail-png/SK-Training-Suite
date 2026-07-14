// src/constants/roles.ts

export const SYSTEM_ROLE_CODES = [
  "SUPER_ADMIN",
  "ADMIN",
] as const;

export const DEFAULT_HIERARCHY_LEVEL = 1;

export const ROLE_PAGE_SIZE = 10;

export const ROLE_SORT_FIELD = "hierarchy_level";

export const ROLE_SORT_ORDER = "asc";

export const ROLE_VALIDATION = {
  ROLE_CODE_REQUIRED: "Role Code is required.",
  ROLE_NAME_REQUIRED: "Role Name is required.",
  COMPANY_REQUIRED: "Company is required.",
  HIERARCHY_REQUIRED: "Hierarchy Level must be greater than or equal to 1.",
  SYSTEM_ROLE_DELETE: "System Roles cannot be deleted.",
} as const;