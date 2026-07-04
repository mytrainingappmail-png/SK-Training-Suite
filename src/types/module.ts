export interface Module {

  id: string;

  course_id: string;

  module_code: string;

  module_name: string;

  description: string;

  module_order: number;

  estimated_minutes: number;

  thumbnail: string;

  active: boolean;

  created_at: string;

  updated_at: string;

}

export type ModuleForm = Omit<
  Module,
  "id" | "created_at" | "updated_at"
>;

export const defaultModuleForm: ModuleForm = {
  course_id: "",
  module_code: "",
  module_name: "",
  description: "",
  module_order: 1,
  estimated_minutes: 1,
  thumbnail: "",
  active: true,
};
