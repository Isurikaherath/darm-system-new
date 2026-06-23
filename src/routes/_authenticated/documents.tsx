import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/documents")({
  component: DocsList,
});

function DocsList() {
  const { data } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*, carts(cart_number, status), departments(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
        <p className="text-sm text-slate-500">All documents in your department.</p>
      </header>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Doc #</th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">File</th>
              <th className="text-left px-4 py-3">Cart</th>
              <th className="text-left px-4 py-3">Department</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.length ? data.map((d: any) => (
              <tr key={d.id}>
                <td className="px-4 py-3 font-mono text-xs">{d.document_number}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{d.document_name}</td>
                <td className="px-4 py-3 text-slate-500">{d.file_number ?? "—"} {d.file_name ? `· ${d.file_name}` : ""}</td>
                <td className="px-4 py-3">
                  <Link to="/carts/$cartId" params={{ cartId: d.cart_id }} className="hover:underline">
                    {d.carts?.cart_number}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-500">{d.departments?.name}</td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">No documents.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
