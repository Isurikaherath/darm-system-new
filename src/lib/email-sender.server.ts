// Shared email dispatch. Sends through the linked Gmail connector, not Resend.
// Reads the visible sender identity from app_settings.

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

function sanitizeHeader(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodeSubject(value: string) {
  const clean = sanitizeHeader(value);
  return /^[\x00-\x7F]*$/.test(clean)
    ? clean
    : `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

function wrapBase64(value: string) {
  return value.replace(/(.{76})/g, "$1\r\n");
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function pickFrom(settings: any) {
  const configured = (settings?.sender_email || process.env.EMAIL_FROM_ADDRESS || "").trim();
  const name = settings?.sender_name || "DARMS";
  if (!configured) return undefined;
  return `${sanitizeHeader(name)} <${sanitizeHeader(configured)}>`;
}

function buildRawEmail({ from, to, subject, html, attachments }: SendArgs & { from: string }) {
  const cleanTo = sanitizeHeader(to);
  const cleanFrom = sanitizeHeader(from);
  const cleanSubject = encodeSubject(subject);

  if (!attachments?.length) {
    return toBase64Url([
      `From: ${cleanFrom}`,
      `To: ${cleanTo}`,
      `Subject: ${cleanSubject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      wrapBase64(Buffer.from(html, "utf8").toString("base64")),
    ].join("\r\n"));
  }

  const mixedBoundary = `mixed_${crypto.randomUUID().replace(/-/g, "")}`;
  const parts = [
    `From: ${cleanFrom}`,
    `To: ${cleanTo}`,
    `Subject: ${cleanSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    ``,
    `--${mixedBoundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    wrapBase64(Buffer.from(html, "utf8").toString("base64")),
  ];

  for (const attachment of attachments) {
    const filename = sanitizeHeader(attachment.filename);
    parts.push(
      `--${mixedBoundary}`,
      `Content-Type: application/octet-stream; name="${filename}"`,
      `Content-Disposition: attachment; filename="${filename}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      wrapBase64(attachment.content),
    );
  }

  parts.push(`--${mixedBoundary}--`);
  return toBase64Url(parts.join("\r\n"));
}

export async function sendSystemEmail({ to, subject, html, attachments }: SendArgs) {
  const settings = await loadEmailSettings();
  const from = pickFrom(settings);
  if (!from) {
    console.warn("[email] sender_email not set — skipping delivery", { to, subject });
    return { skipped: true, reason: "no_sender" as const };
  }

  const lovableApiKey = process.env.LOVABLE_API_KEY;
  const gmailConnectionKey = process.env.GOOGLE_MAIL_API_KEY;
  if (!lovableApiKey || !gmailConnectionKey) {
    console.warn("[email] Gmail connector is not linked — skipping delivery", { to, subject });
    return { skipped: true, reason: "gmail_connector_not_configured" as const };
  }

  const raw = buildRawEmail({ from, to, subject, html, attachments });
  const res = await fetch("https://connector-gateway.lovable.dev/google_mail/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableApiKey}`,
      "X-Connection-Api-Key": gmailConnectionKey,
    },
    body: JSON.stringify({ raw }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Gmail ${res.status}: ${body}`);
  const json = JSON.parse(body);
  return { id: json.id, threadId: json.threadId, from, provider: "gmail" as const };
}
