import * as repo from "../../repositories/email/emailTemplateRepository";
import { sendEmail } from "../../repositories/email/emailRepository";
import type { EmailTemplate, EmailTemplateForm, EmailTemplateBranding } from "../../types/emailTemplate";

export async function loadTemplates(companyId: string): Promise<EmailTemplate[]> {
  return repo.getTemplatesForCompany(companyId);
}

export async function createTemplate(companyId: string, createdBy: string | null, createdByName: string, form: EmailTemplateForm): Promise<EmailTemplate> {
  return repo.createTemplate(companyId, createdBy, createdByName, form);
}

export async function updateTemplate(id: string, patch: Partial<EmailTemplateForm>): Promise<EmailTemplate> {
  return repo.updateTemplate(id, patch);
}

export async function deleteTemplate(id: string): Promise<void> {
  return repo.deleteTemplate(id);
}

/** Replaces every {{variable}} token in `html` with its resolved value,
 * leaving the token in place when no value is available (mirrors the
 * original preview-only behaviour so blank previews stay legible). */
export function compileTemplateHtml(html: string, values: Record<string, string>): string {
  let out = html;
  Object.entries(values).forEach(([token, value]) => {
    out = out.split(token).join(value || token);
  });
  return out;
}

/** Wraps the compiled body in the template's branding chrome (header
 * band with logo/company name, footer band) so a real sent email looks
 * like the in-app preview, not just the bare body HTML. */
export function wrapWithBranding(compiledSubject: string, compiledBodyHtml: string, branding: EmailTemplateBranding): string {
  const headerContent = branding.logoUrl
    ? `<img src="${branding.logoUrl}" alt="" style="height:28px;object-fit:contain;" />`
    : `<span style="font-size:15px;font-weight:700;color:#ffffff;">${branding.headerText || "Company"}</span>`;
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;border:1px solid #f1f5f9;border-radius:12px;overflow:hidden;">
      <div style="padding:16px 20px;background-color:${branding.primaryColor};">${headerContent}</div>
      <div style="padding:24px;background-color:#ffffff;">
        <p style="margin:0 0 12px;font-size:15px;font-weight:600;color:#1e293b;">${compiledSubject}</p>
        <div style="font-size:14px;line-height:1.6;color:#334155;">${compiledBodyHtml}</div>
      </div>
      <div style="padding:14px 20px;text-align:center;font-size:11px;color:#94a3b8;background-color:${branding.secondaryColor}10;">
        ${branding.footerText}
      </div>
    </div>
  `;
}

// Takes primitives rather than an EmailTemplate row so callers still
// editing an in-progress (not-yet-saved) template can send a test without
// round-tripping through the DB shape first.
export async function sendTestEmailRaw(
  toEmail: string,
  subject: string,
  bodyHtml: string,
  branding: EmailTemplateBranding,
  values: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  if (!toEmail) return { success: false, error: "Recipient has no email on file." };
  const compiledSubject = compileTemplateHtml(subject, values);
  const compiledBody = compileTemplateHtml(bodyHtml, values);
  const html = wrapWithBranding(compiledSubject, compiledBody, branding);
  return sendEmail(toEmail, `[TEST] ${compiledSubject}`, html);
}
