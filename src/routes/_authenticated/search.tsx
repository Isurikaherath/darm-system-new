import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/_authenticated/search")({
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["search", q],
    enabled: q.length >= 2,
    queryFn: async () => {
      const term = `%${q}%`;
      const { data, error } = await supabase
        .from("documents")
        .select("*, carts(cart_number, status), departments(name)")
        .or(`document_name.ilike.${term},document_number.ilike.${term},file_number.ilike.${term},file_name.ilike.${term}`)
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Search</h1>
        <p className="text-sm text-slate-500">Find documents by name, number, file number, or file name.</p>
      </header>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type at least 2 characters…" className="max-w-md mb-6" />
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Doc #</th>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">File</th>
              <th className="text-left px-4 py-3">Cart</th>
              <th className="text-left px-4 py-3">Department</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data?.length ? data.map((d: any) => (
              <tr key={d.id}>
                <td className="px-4 py-3 font-mono text-xs">{d.document_number}</td>
                <td className="px-4 py-3 font-medium">{d.document_name}</td>
                <td className="px-4 py-3 text-slate-500">{d.file_number ?? "—"} {d.file_name ? `· ${d.file_name}` : ""}</td>
                <td className="px-4 py-3">{d.carts?.cart_number}</td>
                <td className="px-4 py-3 text-slate-500">{d.departments?.name}</td>
                <td className="px-4 py-3">{d.carts?.status ? <StatusBadge status={d.carts.status} /> : "—"}</td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{q.length < 2 ? "Start typing…" : "No matches."}</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
