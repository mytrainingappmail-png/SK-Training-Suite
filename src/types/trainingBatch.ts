export type BatchStatus =
  | "PLANNED"
  | "ONGOING"
  | "COMPLETED"
  | "CANCELLED";

export interface TrainingBatch {

  id: string;

  company_id: string;

  branch_id: string;

  course_id: string;

  learning_path_id: string;

  trainer_id: string;

  batch_code: string;

  batch_name: string;

  capacity: number;

  enrolled_count: number;

  start_date: string;

  end_date: string;

  status: BatchStatus;

  remarks: string;

  is_active: boolean;

  created_at: string;

  updated_at: string;

}

export type TrainingBatchForm = Omit<
  TrainingBatch,
  "id" | "created_at" | "updated_at"
>;

export const defaultTrainingBatchForm: TrainingBatchForm = {
  company_id:       "",
  branch_id:        "",
  course_id:        "",
  learning_path_id: "",
  trainer_id:       "",
  batch_code:       "",
  batch_name:       "",
  capacity:         0,
  enrolled_count:   0,
  start_date:       "",
  end_date:         "",
  status:           "PLANNED",
  remarks:          "",
  is_active:        true,
};
