import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/disposal")({
  component: Disposal,
});

function Disposal() {
  const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const { data } = useQuery({
    queryKey: ["disposal", in14],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carts")
        .select("*, departments(name)")
        .lte("disposal_date", in14)
        .neq("status", "disposed")
        .order("disposal_date");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600" /> Disposal Alerts
        </h1>
        <p className="text-sm text-slate-500">Carts reaching disposal date within 14 days.</p>
      </header>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Cart #</th>
              <th className="text-left px-4 py-3">Department</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Disposal date</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.length ? data.map((c: any) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium">{c.cart_number}</td>
                <td className="px-4 py-3">{c.departments?.name}</td>
                <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-4 py-3 text-rose-700 font-medium">{c.disposal_date}</td>
                <td className="px-4 py-3 text-right">
                  <Link to="/carts/$cartId" params={{ cartId: c.id }} className="font-medium hover:underline">Open →</Link>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No carts approaching disposal.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
