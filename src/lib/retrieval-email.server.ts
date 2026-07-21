import { sendSystemEmail } from "@/lib/email-sender.server";

function esc(v: unknown) {
  return String(v ?? "—").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function renderDocsTable(docs: any[]) {
  if (!docs.length) return `<p style="color:#64748b;">No documents attached.</p>`;
  const rows = docs.map((d) => `
    <tr>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;">${esc(d.document_number)}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;">${esc(d.document_name)}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;">${esc(d.file_name)}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;">${esc(d.file_number)}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;">${esc(d.retention_period)}</td>
    </tr>`).join("");
  return `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;margin-top:8px;">
    <thead><tr>
      <th style="padding:6px 10px;border:1px solid #e2e8f0;background:#f1f5f9;text-align:left;">Doc #</th>
      <th style="padding:6px 10px;border:1px solid #e2e8f0;background:#f1f5f9;text-align:left;">Name</th>
      <th style="padding:6px 10px;border:1px solid #e2e8f0;background:#f1f5f9;text-align:left;">File</th>
      <th style="padding:6px 10px;border:1px solid #e2e8f0;background:#f1f5f9;text-align:left;">File #</th>
      <th style="padding:6px 10px;border:1px solid #e2e8f0;background:#f1f5f9;text-align:left;">Retention (yrs)</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

export async function sendRetrievalApprovalEmail(cartId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: cart, error } = await supabaseAdmin
    .from("carts")
    .select("id, cart_number, department_id, retention_days, disposal_date, approved_at, updated_at, retrieval_type, status, departments(name), documents(id,document_name,document_number,file_name,file_number,retention_period)")
    .eq("id", cartId)
    .maybeSingle();
  if (error || !cart) throw new Error(error?.message ?? "Cart not found");
  if ((cart as any).status !== "retrieval_approved") {
    return { skipped: true, reason: "cart_not_retrieval_approved" as const };
  }

  const { data: settings } = await supabaseAdmin
    .from("app_settings")
    .select("provider_email")
    .eq("id", true)
    .maybeSingle();
  const providerEmail = (settings as any)?.provider_email as string | undefined;
  if (!providerEmail) return { skipped: true, reason: "provider_email_not_set" as const };

  const c: any = cart;
  const docs = c.documents ?? [];
  const isUrgent = c.retrieval_type === "urgent";
  const headerColor = isUrgent ? "#b91c1c" : "#1d4ed8";
  const headerLabel = isUrgent ? "URGENT Retrieval Approved" : "Retrieval Approved";

  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;">
      <h1 style="color:${headerColor};margin:0 0 6px;">${headerLabel}</h1>
      <table style="font-family:Arial,sans-serif;font-size:13px;margin:8px 0;">
        <tr><td style="padding:2px 8px;color:#475569;">Cart #</td><td style="padding:2px 8px;"><strong>${esc(c.cart_number)}</strong></td></tr>
        <tr><td style="padding:2px 8px;color:#475569;">Department</td><td style="padding:2px 8px;">${esc(c.departments?.name)}</td></tr>
        <tr><td style="padding:2px 8px;color:#475569;">Priority</td><td style="padding:2px 8px;">${esc(c.retrieval_type ?? "normal")}</td></tr>
        <tr><td style="padding:2px 8px;color:#475569;">Documents</td><td style="padding:2px 8px;">${docs.length}</td></tr>
        <tr><td style="padding:2px 8px;color:#475569;">Approved</td><td style="padding:2px 8px;">${esc(new Date(c.approved_at ?? c.updated_at).toLocaleString())}</td></tr>
        <tr><td style="padding:2px 8px;color:#475569;">Retention (days)</td><td style="padding:2px 8px;">${esc(c.retention_days)}</td></tr>
        <tr><td style="padding:2px 8px;color:#475569;">Disposal date</td><td style="padding:2px 8px;">${esc(c.disposal_date)}</td></tr>
      </table>
      <h2 style="font-family:Arial,sans-serif;font-size:15px;margin:16px 0 4px;">Documents</h2>
      ${renderDocsTable(docs)}
    </div>`;

  const subject = `${isUrgent ? "URGENT" : "Normal"} Retrieval — ${c.cart_number}`;
  const result = await sendSystemEmail({ to: providerEmail, subject, html });

  await supabaseAdmin.from("notifications").insert({
    type: isUrgent ? "urgent_retrieval" : "normal_retrieval",
    recipient: providerEmail,
    department_id: c.department_id,
    subject,
    body: html.replace(/<[^>]+>/g, " "),
    payload: { cart_id: cartId },
  });

  return { ok: true, result };
}
