// src/utils/branchScoping.ts
//
// Shared resolution logic for content that can optionally be customized
// per branch (Real Estate Projects, Induction Days). A row with
// branch_id === null is the generic/shared version, visible to every
// branch by default. A row with branch_id set is a branch-specific
// version — usually created via "Clone to Branch", which also sets
// source_id back to the generic row it was cloned from.
//
// For a given employee's branch, this:
//  - drops every other branch's rows entirely
//  - drops a generic row IF that branch already has its own override for it
//    (so the employee sees the branch-customized version, never both)

export interface BranchScoped {
  id: string;
  branch_id: string | null;
  source_id: string | null;
}

export function resolveForBranch<T extends BranchScoped>(rows: T[], employeeBranchId: string | null): T[] {
  const overriddenSourceIds = new Set(
    rows.filter((r) => r.branch_id && employeeBranchId && r.branch_id === employeeBranchId && r.source_id).map((r) => r.source_id as string)
  );

  return rows.filter((r) => {
    if (r.branch_id) return employeeBranchId != null && r.branch_id === employeeBranchId;
    return !overriddenSourceIds.has(r.id);
  });
}
