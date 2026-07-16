// Immediate URGENT retrieval notification: sends cart/document details to the storage provider.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/urgent-retrieval")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cart_id } = (await request.json().catch(() => ({}))) as { cart_id?: string };
        if (!cart_id) return new Response(JSON.stringify({ error: "cart_id required" }), { status: 400 });

        try {
          const { sendUrgentRetrievalEmail } = await import("@/lib/urgent-retrieval-email.server");
          const result = await sendUrgentRetrievalEmail(cart_id);
          return new Response(JSON.stringify({ ok: true, result }), { headers: { "Content-Type": "application/json" } });
        } catch (e: any) {
          console.error("urgent send failed", e);
          return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
        }
      },
    },
  },
});
