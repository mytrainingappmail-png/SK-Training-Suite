export type ResourceType =
  | "video"
  | "pdf"
  | "ppt"
  | "word"
  | "excel"
  | "image"
  | "audio"
  | "zip"
  | "external_url"
  | "youtube"
  | "scorm"
  | "other";

export interface Resource {

  id: string;

  lesson_id: string;

  resource_title: string;

  resource_type: ResourceType;

  file_url: string;

  description: string;

  display_order: number;

  downloadable: boolean;

  active: boolean;

  created_at: string;

  updated_at: string;

}

export type ResourceForm = Omit<
  Resource,
  "id" | "created_at" | "updated_at"
>;

export const defaultResourceForm: ResourceForm = {
  lesson_id:      "",
  resource_title: "",
  resource_type:  "pdf",
  file_url:       "",
  description:    "",
  display_order:  1,
  downloadable:   true,
  active:         true,
};
