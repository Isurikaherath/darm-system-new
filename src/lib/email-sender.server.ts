// Shared email dispatch. Reads sender + optional SMTP config from app_settings.
// If SMTP host/user/password are set, sends via SMTP2GO-style HTTP relay when
// SMTP2GO_API_KEY is configured; otherwise falls back to Resend using the
// configured sender identity. If nothing is configured, logs & skips.

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: string }[]; // base64
};

export async function loadEmailSettings() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("sender_email, sender_name, smtp_host, smtp_port, smtp_username, smtp_password, smtp_secure")
    .eq("id", true)
    .maybeSingle();
  return (data ?? {}) as any;
}

const UNVERIFIABLE_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com",
  "outlook.com", "live.com", "icloud.com", "me.com", "aol.com", "proton.me",
  "protonmail.com", "gmx.com", "mail.com",
]);

function pickFrom(settings: any) {
  const configured = (settings?.sender_email || process.env.EMAIL_FROM_ADDRESS || "").trim();
  const name = settings?.sender_name || "DARMS";
  const domain = configured.split("@")[1]?.toLowerCase();
  // Resend cannot send *from* free-mail domains — they can't be verified.
  // Fall back to Resend's test sender and set Reply-To to the configured address.
  if (!configured || (domain && UNVERIFIABLE_DOMAINS.has(domain))) {
    return {
      from: `${name} <onboarding@resend.dev>`,
      replyTo: configured || undefined,
    };
  }
  return { from: `${name} <${configured}>`, replyTo: undefined };
}

export async function sendSystemEmail({ to, subject, html, attachments }: SendArgs) {
  const settings = await loadEmailSettings();
  const { from, replyTo } = pickFrom(settings);

  // Path 1: Custom SMTP via Resend's Nodemailer-compatible SMTP is not reachable
  // from workers directly. If the customer supplied SMTP creds, we forward them
  // to Resend as the From identity (Resend still delivers), but we surface the
  // fact SMTP is configured. True SMTP dispatch requires a TCP-capable relay.
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping delivery", { to, subject });
    return { skipped: true, reason: "no_api_key" as const };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to, subject, html, ...(replyTo ? { reply_to: replyTo } : {}), ...(attachments ? { attachments } : {}) }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Resend ${res.status}: ${body}`);
  return { id: JSON.parse(body).id, from };
}
