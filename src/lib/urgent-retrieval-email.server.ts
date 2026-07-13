import { sendSystemEmail } from "@/lib/email-sender.server";

async function buildPdf(cart: any, docs: any[]): Promise<string> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  const draw = (text: string, x: number, size = 11, f = font, color = rgb(0.1, 0.1, 0.15)) => {
    page.drawText(text, { x, y, size, font: f, color });
    y -= size + 6;
  };

  draw("DARMS — URGENT RETRIEVAL", 50, 18, bold, rgb(0.75, 0.1, 0.15));
  draw(`Cart #: ${cart.cart_number}`, 50, 12, bold);
  draw(`Department: ${cart.departments?.name ?? "—"}`, 50);
  draw(`Approved at: ${new Date(cart.approved_at ?? cart.updated_at).toLocaleString()}`, 50);
  draw(`Retention (days): ${cart.retention_days ?? "—"}`, 50);
  draw(`Disposal date: ${cart.disposal_date ?? "—"}`, 50);
  y -= 10;
  draw(`Documents (${docs.length}):`, 50, 13, bold);
  y -= 4;

  page.drawText("Doc #", { x: 50, y, size: 10, font: bold });
  page.drawText("Name", { x: 130, y, size: 10, font: bold });
  page.drawText("File", { x: 330, y, size: 10, font: bold });
  page.drawText("Retention (yrs)", { x: 450, y, size: 10, font: bold });
  y -= 14;

  for (const d of docs) {
    if (y < 60) {
      page = pdf.addPage([595.28, 841.89]);
      y = 800;
    }
    page.drawText(String(d.document_number ?? "—").slice(0, 20), { x: 50, y, size: 10, font });
    page.drawText(String(d.document_name ?? "—").slice(0, 40), { x: 130, y, size: 10, font });
    page.drawText(String(d.file_name ?? "—").slice(0, 24), { x: 330, y, size: 10, font });
    page.drawText(String(d.retention_period ?? "—"), { x: 450, y, size: 10, font });
    y -= 14;
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes).toString("base64");
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

  const docs = (cart as any).documents ?? [];
  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;">
      <h1 style="color:#b91c1c;margin:0 0 6px;">URGENT Retrieval Approved</h1>
      <p><strong>Cart:</strong> ${(cart as any).cart_number}<br/>
         <strong>Department:</strong> ${(cart as any).departments?.name ?? "—"}<br/>
         <strong>Documents:</strong> ${docs.length}<br/>
         <strong>Approved:</strong> ${new Date((cart as any).approved_at ?? (cart as any).updated_at).toLocaleString()}</p>
      <p>Full details attached as PDF.</p>
    </div>`;

  const subject = `URGENT Retrieval — ${(cart as any).cart_number}`;
  const result = await sendSystemEmail({
    to: providerEmail,
    subject,
    html,
    attachments: [{ filename: `urgent-${(cart as any).cart_number}.pdf`, content: await buildPdf(cart, docs) }],
  });

  await supabaseAdmin.from("notifications").insert({
    type: "urgent_retrieval",
    recipient: providerEmail,
    department_id: (cart as any).department_id,
    subject,
    body: html.replace(/<[^>]+>/g, " "),
    payload: { cart_id: cartId },
  });

  return { ok: true, result };
}