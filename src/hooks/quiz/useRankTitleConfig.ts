// The trainer's top-rank wording for the admin screens (Results, host screens). Loaded once per company and shared.

import { useEffect, useState } from "react";
import { getCurrentQuizAdmin } from "../../services/quiz/quizAdminSession";
import { getSettings } from "../../repositories/quiz/quizSettingsRepository";
import { parseRankTitles, type RankTitleConfig } from "../../utils/rankTitles";

const cache = new Map<string, Promise<RankTitleConfig>>();

function load(companyId: string): Promise<RankTitleConfig> {
  let p = cache.get(companyId);
  if (!p) {
    p = getSettings(companyId)
      .then((s) => ({ enabled: s.rank_titles_enabled !== false, titles: parseRankTitles(s.rank_titles) }))
      .catch(() => ({ enabled: false, titles: [] }));
    cache.set(companyId, p);
  }
  return p;
}

/** Call after the trainer saves new wording so every screen picks it up. */
export function clearRankTitleCache(): void {
  cache.clear();
}

export function useRankTitleConfig(): RankTitleConfig | null {
  const companyId = getCurrentQuizAdmin()?.company_id;
  const [config, setConfig] = useState<RankTitleConfig | null>(null);
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    void load(companyId).then((c) => { if (!cancelled) setConfig(c); });
    return () => { cancelled = true; };
  }, [companyId]);
  return config;
}
