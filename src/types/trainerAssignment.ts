export type AssignmentType =
  | "PRIMARY"
  | "CO_TRAINER"
  | "GUEST";

export interface TrainerAssignment {

  id: string;

  company_id: string;

  branch_id: string;

  batch_id: string;

  trainer_id: string;

  assignment_type: AssignmentType;

  assigned_from: string;

  assigned_to: string;

  remarks: string;

  is_active: boolean;

  created_at: string;

  updated_at: string;

}

export type TrainerAssignmentForm = Omit<
  TrainerAssignment,
  "id" | "created_at" | "updated_at"
>;

export const defaultTrainerAssignmentForm: TrainerAssignmentForm = {
  company_id:      "",
  branch_id:       "",
  batch_id:        "",
  trainer_id:      "",
  assignment_type: "PRIMARY",
  assigned_from:   "",
  assigned_to:     "",
  remarks:         "",
  is_active:       true,
};
