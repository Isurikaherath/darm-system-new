import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";
import { ROLE_LABELS, type AppRole } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/admin")({
  component: Admin,
});

const ROLES: AppRole[] = ["super_admin", "office_services", "dept_head", "employee"];

function Admin() {
  const { data: user } = useCurrentUser();
  const qc = useQueryClient();
  const isAdmin = user?.roles.includes("super_admin");

  const usersQ = useQuery({
    queryKey: ["all-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles").select("*, departments(name)").order("created_at", { ascending: false });
      if (error) throw error;
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const map = new Map<string, AppRole[]>();
      (roles ?? []).forEach((r: any) => {
        const a = map.get(r.user_id) ?? [];
        a.push(r.role);
        map.set(r.user_id, a);
      });
      return profiles.map((p: any) => ({ ...p, roles: map.get(p.id) ?? [] }));
    },
  });

  const depsQ = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await supabase.from("departments").select("*").order("name")).data ?? [],
  });

  const [newDept, setNewDept] = useState("");

  if (!isAdmin) {
    return <div className="text-slate-500">Only Super Admins can access this page.</div>;
  }

  const updateProfile = async (id: string, patch: any) => {
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["all-users"] }); }
  };

  const setUserRole = async (userId: string, role: AppRole) => {
    // Replace all existing roles with the chosen single primary role
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) toast.error(error.message);
    else { toast.success(`Role set to ${ROLE_LABELS[role]}`); qc.invalidateQueries({ queryKey: ["all-users"] }); }
  };

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
        <p className="text-sm text-slate-500">Activate users, assign roles & departments, manage departments.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6">
          <h2 className="font-semibold mb-3">Departments</h2>
          <ul className="space-y-1 text-sm mb-3">
            {depsQ.data?.map((d: any) => <li key={d.id} className="text-slate-700">{d.name}</li>)}
          </ul>
          <form className="flex gap-2" onSubmit={async (e) => {
            e.preventDefault();
            if (!newDept) return;
            const { error } = await supabase.from("departments").insert({ name: newDept });
            if (error) return toast.error(error.message);
            setNewDept(""); qc.invalidateQueries({ queryKey: ["departments"] });
          }}>
            <Input value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="New department" />
            <Button type="submit">Add</Button>
          </form>
        </Card>

        <Card className="lg:col-span-2 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 font-semibold">Users</div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
              <tr>
                <th className="text-left px-4 py-2">User</th>
                <th className="text-left px-4 py-2">Department</th>
                <th className="text-left px-4 py-2">Role</th>
                <th className="text-left px-4 py-2">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usersQ.data?.map((u: any) => (
                <tr key={u.id}>
                  <td className="px-4 py-2">
                    <div className="font-medium">{u.full_name ?? u.email}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-2">
                    <select className="border border-slate-200 rounded px-2 py-1 text-sm"
                      value={u.department_id ?? ""}
                      onChange={(e) => updateProfile(u.id, { department_id: e.target.value || null })}>
                      <option value="">—</option>
                      {depsQ.data?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <select className="border border-slate-200 rounded px-2 py-1 text-sm"
                      value={u.roles[0] ?? "employee"}
                      onChange={(e) => setUserRole(u.id, e.target.value as AppRole)}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={u.is_active}
                        onChange={(e) => updateProfile(u.id, { is_active: e.target.checked })} />
                      <span className="text-xs">{u.is_active ? "Active" : "Inactive"}</span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
