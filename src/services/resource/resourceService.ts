import type { Resource } from "../../types/resource";
import type { ResourceForm } from "../../types/resource";

import {
  getResources,
  createResource as repositoryCreateResource,
  updateResource,
  deleteResource,
  toggleResourceStatus as repositoryToggleResourceStatus,
} from "../../repositories/resource/resourceRepository";

export async function loadResources(): Promise<Resource[]> {
  return await getResources();
}

export async function createResource(data: ResourceForm): Promise<Resource> {
  validateResourceForm(data);
  return await repositoryCreateResource(data);
}

export async function saveResource(
  id: string,
  data: Partial<ResourceForm>
): Promise<Resource> {
  if (!id) throw new Error("Invalid Resource ID.");
  validateResourceForm(data);
  return await updateResource(id, data);
}

export async function removeResource(id: string): Promise<void> {
  if (!id) throw new Error("Invalid Resource ID.");
  await deleteResource(id);
}

export async function toggleResourceStatus(
  id: string,
  active: boolean
): Promise<Resource> {
  if (!id) throw new Error("Invalid Resource ID.");
  return await repositoryToggleResourceStatus(id, active);
}

function validateResourceForm(data: Partial<ResourceForm>): void {
  if (!data.lesson_id)              throw new Error("Lesson is required.");
  if (!data.resource_title?.trim()) throw new Error("Resource Title is required.");
  if (!data.resource_type)          throw new Error("Resource Type is required.");
  if (!data.file_url?.trim())       throw new Error("File URL is required.");

  if (data.display_order !== undefined && data.display_order < 1) {
    throw new Error("Display Order must be at least 1.");
  }
}
