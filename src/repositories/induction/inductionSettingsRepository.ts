// "When someone finishes the whole induction": the company's switches (mark the induction completed, issue a
// certificate, what to call it, whether standalone parts count) and the employee's own certificate lookup.
// The database does the actual completing/issuing (a trigger); these are just the switches.

import { supabase } from '../../lib/supabase';

export interface InductionSettings {
  auto_complete: boolean;
  certificate_enabled: boolean;
  certificate_title: string;
  require_standalone_days: boolean;
}

export const DEFAULT_INDUCTION_SETTINGS: InductionSettings = {
  auto_complete: true, certificate_enabled: true, certificate_title: 'Induction Program', require_standalone_days: true,
};

export async function getInductionSettings(companyId: string): Promise<InductionSettings> {
  const { data, error } = await supabase.from('induction_settings').select('*').eq('company_id', companyId).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? {
    auto_complete: data.auto_complete, certificate_enabled: data.certificate_enabled,
    certificate_title: data.certificate_title, require_standalone_days: data.require_standalone_days,
  } : { ...DEFAULT_INDUCTION_SETTINGS };
}

export async function saveInductionSettings(companyId: string, settings: InductionSettings): Promise<void> {
  const { error } = await supabase
    .from('induction_settings')
    .upsert({ company_id: companyId, ...settings, certificate_title: settings.certificate_title.trim() || DEFAULT_INDUCTION_SETTINGS.certificate_title, updated_at: new Date().toISOString() }, { onConflict: 'company_id' });
  if (error) throw new Error(error.message);
}

/** Checks everyone in the company now; returns how many inductions / certificates were newly completed / issued. */
export async function checkEveryoneComplete(): Promise<{ completed: number; certificates: number }> {
  const { data, error } = await supabase.rpc('induction_check_all_complete');
  if (error) throw new Error(error.message);
  const r = (data ?? {}) as { completed?: number; certificates?: number };
  return { completed: r.completed ?? 0, certificates: r.certificates ?? 0 };
}

/** The employee's "induction completed" certificate, if one has been issued. */
export async function getMyInductionCertificate(employeeId: string): Promise<{ id: string; title: string; number: string } | null> {
  const { data, error } = await supabase
    .from('certificates')
    .select('id, certificate_title, certificate_no')
    .eq('employee_id', employeeId).like('remarks', 'induction:%')
    .eq('generated', true).eq('published', true).neq('active', false)
    .order('issue_date', { ascending: false }).limit(1);
  if (error) return null;
  const c = data?.[0];
  return c ? { id: c.id as string, title: (c.certificate_title as string) ?? 'Induction Program', number: (c.certificate_no as string) ?? '' } : null;
}
