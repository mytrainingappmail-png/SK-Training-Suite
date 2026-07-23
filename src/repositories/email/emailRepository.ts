import { supabase } from "../../lib/supabase";

// Thin wrapper over the send-email Edge Function. Never throws on a
// delivery failure (missing Resend secrets, bad address, provider error) —
// returns { success, error } so callers can decide whether that's fatal
// (e.g. "Send Test Email" surfaces it) or best-effort (e.g. a ticket
// notification, which must never block the underlying DB write).
export async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: { to, subject, html },
    });

    if (error) return { success: false, error: error.message };
    if (data && data.success === false) return { success: false, error: data.error ?? "Unknown error" };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
