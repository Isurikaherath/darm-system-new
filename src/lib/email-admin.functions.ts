import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { to: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin" as any,
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { sendSystemEmail, loadEmailSettings } = await import("@/lib/email-sender.server");
    const settings = await loadEmailSettings();
    const html = `
      <div style="font-family:Arial,sans-serif;color:#0f172a;">
        <h2>DARMS — Test Email</h2>
        <p>This test message was sent from your DARMS admin panel.</p>
        <p><strong>Sender:</strong> ${settings?.sender_name ?? "DARMS"} &lt;${settings?.sender_email ?? "(not set)"}&gt;</p>
        <p><strong>Delivery:</strong> Connected Gmail account</p>
        <p>If you received this, Gmail sending is working.</p>
      </div>`;
    const result = await sendSystemEmail({
      to: data.to,
      subject: "DARMS — Test email",
      html,
    });
    return { ok: true, result };
  });
