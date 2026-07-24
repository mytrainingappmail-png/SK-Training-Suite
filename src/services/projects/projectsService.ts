// src/services/projects/projectsService.ts
//
// "Projects" now reads from the dedicated real_estate_projects system
// — genuinely separate from Course. No pass %, no duration, no
// certificate gating — every employee can browse every active project
// and its brochures whenever they like.

import { loadCategories } from '../realEstateProject/realEstateProjectService';
import { loadProjects } from '../realEstateProject/realEstateProjectService';
import { loadAllBrochures } from '../realEstateProject/realEstateProjectService';
import { loadAllSections } from '../realEstateProject/realEstateProjectService';
import type { RealEstateProjectSection } from '../../types/realEstateProjectSection';

export interface ProjectBrochure {
  resourceId: string;
  title: string;
  fileUrl: string;
}

export interface ProjectCourse {
  courseId: string;
  courseName: string;
  shortDescription: string;
  fullDescription: string;
  thumbnail: string;
  brochures: ProjectBrochure[];
  sections: RealEstateProjectSection[];
}

export interface Project {
  categoryId: string;
  categoryName: string;
  description: string;
  courses: ProjectCourse[];
}

export async function loadProjectsForEmployee(_employeeId: string): Promise<Project[]> {
  const [categories, projects, brochures, sections] = await Promise.all([
    loadCategories(),
    loadProjects(),
    loadAllBrochures(),
    loadAllSections(),
  ]);

  const activeCategories = categories.filter((c) => c.active);

  return activeCategories
    .map((category) => {
      const categoryProjects = projects
        .filter((p) => p.category_id === category.id && p.active)
        .map((p) => ({
          courseId: p.id,
          courseName: p.project_name,
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

      return {
        categoryId: category.id,
        categoryName: category.category_name,
        description: category.description,
        courses: categoryProjects,
      };
    })
    .filter((project) => project.courses.length > 0);
}
