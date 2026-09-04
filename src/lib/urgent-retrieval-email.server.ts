import { sendSystemEmail } from "@/lib/email-sender.server";

function esc(v: unknown) {
  return String(v ?? "—").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}


export async function sendUrgentRetrievalEmail(cartId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: cart, error } = await supabaseAdmin
    .from("carts")
    .select("id, cart_number, department_id, retention_days, disposal_date, approved_at, updated_at, retrieval_type, status, departments(name), documents(id,document_name,document_number,file_name,file_number,retention_period)")
    .eq("id", cartId)
    .maybeSingle();
  if (error || !cart) throw new Error(error?.message ?? "Cart not found");
  if ((cart as any).retrieval_type !== "urgent" || (cart as any).status !== "retrieval_approved") {
    return { skipped: true, reason: "cart_not_urgent_approved" as const };
  }

  const { data: settings } = await supabaseAdmin
    .from("app_settings")
    .select("provider_email")
    .eq("id", true)
    .maybeSingle();
  const providerEmail = (settings as any)?.provider_email as string | undefined;
  if (!providerEmail) return { skipped: true, reason: "provider_email_not_set" as const };

  const c: any = cart;
  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;">
      <h1 style="color:#b91c1c;margin:0 0 6px;">URGENT Retrieval</h1>
      <table style="font-family:Arial,sans-serif;font-size:13px;margin:8px 0;">
        <tr><td style="padding:2px 8px;color:#475569;">Cart</td><td style="padding:2px 8px;"><strong>${esc(c.cart_number)}</strong></td></tr>
        <tr><td style="padding:2px 8px;color:#475569;">Department</td><td style="padding:2px 8px;">${esc(c.departments?.name)}</td></tr>
        <tr><td style="padding:2px 8px;color:#475569;">Priority</td><td style="padding:2px 8px;">urgent</td></tr>
      </table>
      <p style="margin:16px 0 8px;font-size:13px;color:#0f172a;">Please bring this cart to the department today.</p>
    </div>`;

  const subject = `URGENT Retrieval — ${c.cart_number}`;
  const result = await sendSystemEmail({ to: providerEmail, subject, html });

  await supabaseAdmin.from("notifications").insert({
    type: "urgent_retrieval",
    recipient: providerEmail,
    department_id: c.department_id,
    subject,
    body: html.replace(/<[^>]+>/g, " "),
    payload: { cart_id: cartId },
  });

  return { ok: true, result };
}
