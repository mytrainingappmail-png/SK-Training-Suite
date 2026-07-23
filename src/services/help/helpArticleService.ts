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

const STOPWORDS = new Set([
  'how', 'do', 'does', 'did', 'i', 'a', 'an', 'the', 'to', 'for', 'of', 'in', 'on',
  'is', 'are', 'and', 'or', 'my', 'me', 'can', 'you', 'please', 'what', 'when',
  'where', 'why', 'it', 'this', 'that', 'with', 'about',
]);

/**
 * Word-based matching (not whole-phrase substring matching) — a natural
 * question like "how do I create a course?" needs to match an article
 * whose title/keywords contain "create"/"course" individually, since the
 * literal full phrase never appears verbatim in any article. Results are
 * ranked by how many significant words matched (title/keyword hits count
 * more than a body-text hit), so the most relevant article surfaces first.
 */
export function searchArticles(articles: HelpArticle[], query: string): HelpArticle[] {
  const term = query.trim().toLowerCase();
  if (!term) return articles;

  const words = term.split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOPWORDS.has(w));

  const scored = articles.map((article) => {
    const title = article.title.toLowerCase();
    const keywords = article.keywords.toLowerCase();
    const body = stripHtml(article.content_html).toLowerCase();

    let score = 0;
    if (title.includes(term) || keywords.includes(term)) score += 10;
    for (const w of words) {
      if (title.includes(w)) score += 3;
      if (keywords.includes(w)) score += 3;
      if (body.includes(w)) score += 1;
    }
    // No significant words at all (e.g. query was only stopwords/short) —
    // fall back to the original whole-phrase substring check.
    if (words.length === 0 && (title.includes(term) || keywords.includes(term) || body.includes(term))) {
      score += 1;
    }
    return { article, score };
  });

  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).map((s) => s.article);
}
