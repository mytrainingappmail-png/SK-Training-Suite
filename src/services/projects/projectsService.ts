// src/services/projects/projectsService.ts
//
// "Projects" reads from the dedicated real_estate_projects system —
// genuinely separate from Course. No pass %, no duration, no
// certificate gating — every employee can browse every active project
// and its brochures whenever they like. A flat list — no category
// grouping, since in practice every project ended up with its own
// one-to-one category that added no real value.

import { loadProjects } from '../realEstateProject/realEstateProjectService';
import { loadAllBrochures } from '../realEstateProject/realEstateProjectService';
import { loadAllSections } from '../realEstateProject/realEstateProjectService';
import type { RealEstateProjectSection } from '../../types/realEstateProjectSection';

export interface ProjectBrochure {
  resourceId: string;
  title: string;
  fileUrl: string;
}

export interface Project {
  projectId: string;
  projectName: string;
  shortDescription: string;
  fullDescription: string;
  thumbnail: string;
  brochures: ProjectBrochure[];
  sections: RealEstateProjectSection[];
}

export async function loadProjectsForEmployee(_employeeId: string): Promise<Project[]> {
  const [projects, brochures, sections] = await Promise.all([
    loadProjects(),
    loadAllBrochures(),
    loadAllSections(),
  ]);

  return projects
    .filter((p) => p.active)
    .map((p) => ({
      projectId: p.id,
      projectName: p.project_name,
      shortDescription: p.short_description,
      fullDescription: p.full_description,
      thumbnail: p.thumbnail_url,
      brochures: brochures
        .filter((b) => b.project_id === p.id)
        .map((b) => ({ resourceId: b.id, title: b.title, fileUrl: b.file_url })),
      sections: sections
        .filter((s) => s.project_id === p.id)
        .sort((a, b) => a.display_order - b.display_order),
    }));
}
