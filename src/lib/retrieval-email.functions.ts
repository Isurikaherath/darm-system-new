import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const notifyUrgentRetrievalApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { cartId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: canApprove } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin" as any,
    });
    const { data: isOffice } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "office_services" as any,
    });
    const { data: isDeptHead } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "dept_head" as any,
    });

    if (!canApprove && !isOffice && !isDeptHead) throw new Error("Forbidden");

    const { data: cart, error } = await context.supabase
      .from("carts")
      .select("id")
      .eq("id", data.cartId)
      .eq("status", "retrieval_approved")
      .eq("retrieval_type", "urgent")
      .maybeSingle();
    if (error || !cart) throw new Error(error?.message ?? "Urgent retrieval cart not found");

    const { sendUrgentRetrievalEmail } = await import("@/lib/urgent-retrieval-email.server");
    return sendUrgentRetrievalEmail(data.cartId);
  });