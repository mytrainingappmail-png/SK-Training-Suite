import * as repo from "../../repositories/help/helpArticleRepository";
import type { HelpArticle, HelpArticleForm } from "../../types/helpArticle";

export async function loadArticles(): Promise<HelpArticle[]> {
  return repo.getAllArticles();
}

export async function createArticle(createdBy: string | null, createdByName: string, form: HelpArticleForm): Promise<HelpArticle> {
  return repo.createArticle(createdBy, createdByName, form);
}

export async function updateArticle(id: string, patch: Partial<HelpArticleForm>): Promise<HelpArticle> {
  return repo.updateArticle(id, patch);
}

export async function deleteArticle(id: string): Promise<void> {
  return repo.deleteArticle(id);
}

/** Plain-text strip for search matching against content_html (so search
 * finds words inside the rendered body, not just the title/keywords). */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
}

export function searchArticles(articles: HelpArticle[], query: string): HelpArticle[] {
  const term = query.trim().toLowerCase();
  if (!term) return articles;
  return articles.filter((a) =>
    a.title.toLowerCase().includes(term) ||
    a.keywords.toLowerCase().includes(term) ||
    stripHtml(a.content_html).toLowerCase().includes(term)
  );
}
