import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/retrievals")({
  component: Retrievals,
});

function Retrievals() {
  const { data } = useQuery({
    queryKey: ["retrievals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carts")
        .select("*, departments(name)")
        .in("status", ["pending_retrieval_approval", "retrieved", "pending_return_approval"])
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Retrievals</h1>
        <p className="text-sm text-slate-500">Open retrieval and return workflow items.</p>
      </header>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Cart #</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Department</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.length ? data.map((c: any) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium">{c.cart_number}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3">{c.retrieval_type ? <Badge variant={c.retrieval_type === "urgent" ? "destructive" : "secondary"}>{c.retrieval_type}</Badge> : "—"}</td>
                <td className="px-4 py-3">{c.departments?.name}</td>
                <td className="px-4 py-3 text-right">
                  <Link to="/carts/$cartId" params={{ cartId: c.id }} className="font-medium hover:underline">Open →</Link>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Nothing open.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
