import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const notifyApprovalDecision = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { cartId: string; decision: "approved" | "rejected"; kind: string; reason?: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: cart, error } = await context.supabase
      .from("carts")
      .select("cart_number, created_by, status, departments(name)")
      .eq("id", data.cartId)
      .maybeSingle();
    if (error || !cart) throw new Error(error?.message ?? "Cart not found");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("id", (cart as any).created_by)
      .maybeSingle();

    if (!prof?.email) return { ok: false, reason: "no recipient" };

    const { sendSystemEmail } = await import("@/lib/email-sender.server");
    const decisionLabel = data.decision === "approved" ? "approved" : "rejected";
    const color = data.decision === "approved" ? "#16a34a" : "#dc2626";
    const html = `
      <div style="font-family:Arial,sans-serif;color:#0f172a;">
        <h2 style="color:${color};">Your ${data.kind} request was ${decisionLabel}</h2>
        <p>Hi ${prof.full_name ?? ""},</p>
        <p>Cart <strong>${(cart as any).cart_number}</strong> (${(cart as any).departments?.name ?? ""}) has been <strong>${decisionLabel}</strong>.</p>
        ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ""}
        <p>— DARMS</p>
      </div>`;
    const result = await sendSystemEmail({
      to: prof.email,
      subject: `DARMS — ${data.kind} ${decisionLabel}: ${(cart as any).cart_number}`,
      html,
    });
    return { ok: true, result };
  });
