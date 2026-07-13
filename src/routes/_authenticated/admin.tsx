import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Trash2, Send, RefreshCw, Database, PlugZap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/hooks/use-current-user";
import { toast } from "sonner";
import { ROLE_LABELS, type AppRole } from "@/lib/types";
import { useServerFn } from "@tanstack/react-start";
import { sendTestEmail } from "@/lib/email-admin.functions";
import { testMirror, resyncMirror, retryMirrorFailures, deployMirrorSchema } from "@/lib/mirror.functions";


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
    queryKey: ["departments-admin"],
    queryFn: async () => (await supabase.from("departments").select("*").order("name")).data ?? [],
  });

  const jobsQ = useQuery({
    queryKey: ["job-titles"],
    queryFn: async () => (await supabase.from("job_titles").select("*").order("name")).data ?? [],
  });

  const settingsQ = useQuery({
    queryKey: ["app-settings"],
    enabled: isAdmin,
    queryFn: async () => (await supabase.from("app_settings").select("*").eq("id", true).maybeSingle()).data,
  });

  const [newDept, setNewDept] = useState("");
  const [newJob, setNewJob] = useState("");
  const [providerEmail, setProviderEmail] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("DARMS");
  const [testTo, setTestTo] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const testEmailFn = useServerFn(sendTestEmail);

  const [mirrorUrl, setMirrorUrl] = useState("");
  const [mirrorKey, setMirrorKey] = useState("");
  const [mirrorDbUrl, setMirrorDbUrl] = useState("");
  const [mirrorEnabled, setMirrorEnabled] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [showDbUrl, setShowDbUrl] = useState(false);
  const [mirrorBusy, setMirrorBusy] = useState<"" | "test" | "sync" | "retry" | "deploy">("");
  const testMirrorFn = useServerFn(testMirror);
  const resyncMirrorFn = useServerFn(resyncMirror);
  const retryMirrorFn = useServerFn(retryMirrorFailures);
  const deploySchemaFn = useServerFn(deployMirrorSchema);

  const failuresQ = useQuery({
    queryKey: ["mirror-failures"],
    enabled: isAdmin,
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("mirror_failures")
        .select("*")
        .is("resolved_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (settingsQ.data) {
      const s: any = settingsQ.data;
      setProviderEmail(s.provider_email ?? "");
      setSenderEmail(s.sender_email ?? "");
      setSenderName(s.sender_name ?? "DARMS");
      setMirrorUrl(s.mirror_url ?? "");
      setMirrorKey(s.mirror_service_key ?? "");
      setMirrorDbUrl(s.mirror_db_url ?? "");
      setMirrorEnabled(!!s.mirror_enabled);
    }
  }, [settingsQ.data]);


  if (!isAdmin) {
    return <div className="text-slate-500">Only Super Admins can access this page.</div>;
  }

  const updateProfile = async (id: string, patch: any) => {
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["all-users"] }); }
  };

  const setUserRole = async (userId: string, role: AppRole) => {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) toast.error(error.message);
    else { toast.success(`Role set to ${ROLE_LABELS[role]}`); qc.invalidateQueries({ queryKey: ["all-users"] }); }
  };

  const deleteDept = async (id: string, name: string) => {
    if (!confirm(`Delete department "${name}"? Users/carts referencing it may block deletion.`)) return;
    const { error } = await supabase.from("departments").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Department deleted"); qc.invalidateQueries({ queryKey: ["departments-admin"] }); }
  };

  const deleteJob = async (id: string, name: string) => {
    if (!confirm(`Delete role "${name}"?`)) return;
    const { error } = await supabase.from("job_titles").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Role deleted"); qc.invalidateQueries({ queryKey: ["job-titles"] }); }
  };

  const setDeptColor = async (id: string, color: string | null) => {
    const { error } = await supabase.from("departments").update({ theme_color: color }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Theme color updated"); qc.invalidateQueries({ queryKey: ["departments-admin"] }); qc.invalidateQueries({ queryKey: ["dept-theme"] }); }
  };

  const saveProviderEmail = async () => {
    const email = providerEmail.trim();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return toast.error("Enter a valid email");
    const { error } = await supabase
      .from("app_settings")
      .update({ provider_email: email || null, updated_at: new Date().toISOString() })
      .eq("id", true);
    if (error) return toast.error(error.message);
    toast.success("Provider email saved");
    qc.invalidateQueries({ queryKey: ["app-settings"] });
  };

  const saveSmtpSettings = async () => {
    const email = senderEmail.trim();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) return toast.error("Enter a valid sender email");
    const { error } = await supabase
      .from("app_settings")
      .update({
        sender_email: email,
        sender_name: senderName.trim() || "DARMS",
        smtp_host: null,
        smtp_port: null,
        smtp_username: null,
        smtp_password: null,
        smtp_secure: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (error) return toast.error(error.message);
    toast.success("Email sender settings saved");
    qc.invalidateQueries({ queryKey: ["app-settings"] });
  };

  const runTestEmail = async () => {
    const to = testTo.trim() || senderEmail.trim();
    if (!to || !/^\S+@\S+\.\S+$/.test(to)) return toast.error("Enter a recipient email");
    setSendingTest(true);
    try {
      await testEmailFn({ data: { to } });
      toast.success(`Test email sent to ${to}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send test email");
    } finally {
      setSendingTest(false);
    }
  };

  const saveMirrorConfig = async () => {
    if (mirrorUrl && !/^https?:\/\//.test(mirrorUrl)) return toast.error("Mirror URL must start with https://");
    if (mirrorDbUrl && !/^postgres(ql)?:\/\//.test(mirrorDbUrl)) return toast.error("DB URL must start with postgres:// or postgresql://");
    const { error } = await supabase
      .from("app_settings")
      .update({
        mirror_url: mirrorUrl.trim() || null,
        mirror_service_key: mirrorKey.trim() || null,
        mirror_db_url: mirrorDbUrl.trim() || null,
        mirror_enabled: mirrorEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (error) return toast.error(error.message);
    toast.success("Backup mirror settings saved");
    qc.invalidateQueries({ queryKey: ["app-settings"] });
  };

  const runMirrorAction = async (kind: "test" | "sync" | "retry" | "deploy") => {
    setMirrorBusy(kind);
    try {
      if (kind === "deploy") {
        await deploySchemaFn();
        toast.success("Schema deployed to external DB");
      } else if (kind === "test") {
        await testMirrorFn();
        toast.success("Connection OK — external DB reachable");
      } else if (kind === "sync") {
        const r: any = await resyncMirrorFn();
        const failed = Object.entries(r.results).filter(([, v]: any) => !v.ok);
        const prefix = r.schemaDeployed ? "Schema deployed · " : "";
        if (failed.length) toast.error(`${prefix}Sync finished with ${failed.length} table(s) failing — see mirror_failures`);
        else toast.success(`${prefix}Full resync complete`);
      } else {
        const r: any = await retryMirrorFn();
        toast.success(`Retried ${r.attempted}, resolved ${r.resolved}`);
        qc.invalidateQueries({ queryKey: ["mirror-failures"] });
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Mirror action failed");
    } finally {
      setMirrorBusy("");
    }
  };





  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
        <p className="text-sm text-slate-500">Activate users, assign roles & departments, manage lookups.</p>
      </header>

      <Card className="p-6 mb-6">
        <h2 className="font-semibold text-slate-900 mb-1">Storage provider email</h2>
        <p className="text-xs text-slate-500 mb-3">
          Daily digest of approved carts &amp; normal retrievals is sent to this address at <strong>3:00 PM</strong> (only if there is new activity since the last send).
          Urgent retrievals are emailed immediately with a PDF attachment after approval.
        </p>
        <div className="flex gap-2 max-w-lg">
          <Input type="email" placeholder="provider@example.com" value={providerEmail} onChange={(e) => setProviderEmail(e.target.value)} />
          <Button onClick={saveProviderEmail}>Save</Button>
        </div>
        {settingsQ.data && (settingsQ.data as any).last_daily_sent_at && (
          <p className="text-xs text-slate-500 mt-2">
            Last daily send: {new Date((settingsQ.data as any).last_daily_sent_at).toLocaleString()}
          </p>
        )}
      </Card>

      <Card className="p-6 mb-6">
        <h2 className="font-semibold text-slate-900 mb-1">Email sender</h2>
        <p className="text-xs text-slate-500 mb-4">
          Configure the Gmail sender used for storage provider emails. Approval emails are sent only for urgent retrieval approvals.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
          <div>
            <Label className="text-xs">Sender email *</Label>
            <Input type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="pasinduthambugala@gmail.com" />
          </div>
          <div>
            <Label className="text-xs">Sender display name</Label>
            <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="DARMS" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <Button onClick={saveSmtpSettings}>Save sender</Button>
          <div className="flex gap-2 items-center ml-0 md:ml-4">
            <Input
              type="email"
              className="max-w-xs"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder={senderEmail || "recipient@example.com"}
            />
            <Button variant="outline" onClick={runTestEmail} disabled={sendingTest}>
              <Send className="w-4 h-4 mr-1" /> {sendingTest ? "Sending…" : "Send test email"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">Emails are sent through the connected Gmail account, not Resend.</p>
      </Card>

      <Card className="p-6 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Database className="w-4 h-4 text-slate-700" />
          <h2 className="font-semibold text-slate-900">Backup mirror (external Supabase)</h2>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Every write in this system is mirrored to an external Supabase project as a read-only backup.
          Toggle off to pause mirroring. Rows that fail are logged below and can be retried.
          Run the schema script <code className="px-1 bg-slate-100 rounded">/external-schema.sql</code> once on the external project.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
          <div>
            <Label className="text-xs">External project URL</Label>
            <Input value={mirrorUrl} onChange={(e) => setMirrorUrl(e.target.value)} placeholder="https://xxxx.supabase.co" />
          </div>
          <div>
            <Label className="text-xs">Service role key (secret)</Label>
            <div className="flex gap-1">
              <Input type={showKey ? "text" : "password"} value={mirrorKey} onChange={(e) => setMirrorKey(e.target.value)} placeholder="sb_secret_… or eyJ…" />
              <Button type="button" variant="outline" size="sm" onClick={() => setShowKey((v) => !v)}>{showKey ? "Hide" : "Show"}</Button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Never a publishable/anon key — must be service_role.</p>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 mt-4 text-sm">
          <input type="checkbox" checked={mirrorEnabled} onChange={(e) => setMirrorEnabled(e.target.checked)} />
          Enable real-time mirroring
        </label>
        <div className="flex flex-wrap gap-2 mt-4">
          <Button onClick={saveMirrorConfig}>Save mirror settings</Button>
          <Button variant="outline" onClick={() => runMirrorAction("test")} disabled={!!mirrorBusy}>
            <PlugZap className="w-4 h-4 mr-1" /> {mirrorBusy === "test" ? "Testing…" : "Test connection"}
          </Button>
          <Button variant="outline" onClick={() => runMirrorAction("sync")} disabled={!!mirrorBusy}>
            <RefreshCw className="w-4 h-4 mr-1" /> {mirrorBusy === "sync" ? "Syncing…" : "Full resync"}
          </Button>
          <Button variant="outline" onClick={() => runMirrorAction("retry")} disabled={!!mirrorBusy || !(failuresQ.data?.length)}>
            {mirrorBusy === "retry" ? "Retrying…" : `Retry failures (${failuresQ.data?.length ?? 0})`}
          </Button>
        </div>
        {!!failuresQ.data?.length && (
          <div className="mt-4 border border-red-200 rounded bg-red-50 p-3 text-xs">
            <div className="font-semibold text-red-800 mb-1">Recent failures</div>
            <ul className="space-y-1 text-red-700 max-h-40 overflow-auto">
              {failuresQ.data.slice(0, 10).map((f: any) => (
                <li key={f.id}>
                  <span className="font-mono">{f.table_name}</span> · {f.op} · {new Date(f.created_at).toLocaleTimeString()} — {f.error?.slice(0, 120)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>





      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-6">
          <h2 className="font-semibold mb-3">Departments</h2>
          <ul className="space-y-2 text-sm mb-3">
            {depsQ.data?.map((d: any) => (
              <li key={d.id} className="flex items-center justify-between text-slate-700 gap-2">
                <span className="flex items-center gap-2 flex-1 min-w-0">
                  <span
                    className="w-4 h-4 rounded border border-slate-300 shrink-0"
                    style={{ backgroundColor: d.theme_color ?? "transparent" }}
                    title={d.theme_color ?? "Default"}
                  />
                  <span className="truncate">{d.name}</span>
                </span>
                <input
                  type="color"
                  value={d.theme_color ?? "#f8fafc"}
                  onChange={(e) => setDeptColor(d.id, e.target.value)}
                  className="w-8 h-6 border rounded cursor-pointer"
                  title="Pick theme color"
                />
                <label className="inline-flex items-center gap-1 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={!d.theme_color}
                    onChange={(e) => setDeptColor(d.id, e.target.checked ? null : (d.theme_color ?? "#f1f5f9"))}
                  />
                  Default
                </label>
                <button onClick={() => deleteDept(d.id, d.name)} className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
          <form className="flex gap-2" onSubmit={async (e) => {
            e.preventDefault();
            if (!newDept) return;
            const { error } = await supabase.from("departments").insert({ name: newDept });
            if (error) return toast.error(error.message);
            setNewDept(""); qc.invalidateQueries({ queryKey: ["departments-admin"] });
          }}>
            <Input value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="New department" />
            <Button type="submit">Add</Button>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-3">Roles (Job Titles)</h2>
          <p className="text-xs text-slate-500 mb-2">Shown in the signup form.</p>
          <ul className="space-y-1 text-sm mb-3">
            {jobsQ.data?.map((j: any) => (
              <li key={j.id} className="flex items-center justify-between text-slate-700">
                <span>{j.name}</span>
                <button onClick={() => deleteJob(j.id, j.name)} className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
          <form className="flex gap-2" onSubmit={async (e) => {
            e.preventDefault();
            if (!newJob) return;
            const { error } = await supabase.from("job_titles").insert({ name: newJob });
            if (error) return toast.error(error.message);
            setNewJob(""); qc.invalidateQueries({ queryKey: ["job-titles"] });
          }}>
            <Input value={newJob} onChange={(e) => setNewJob(e.target.value)} placeholder="New role" />
            <Button type="submit">Add</Button>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-2">Permission Roles</h2>
          <p className="text-xs text-slate-500 mb-3">System-level access tiers. Assign per user in the table below.</p>
          <ul className="text-sm space-y-1 text-slate-700">
            {ROLES.map((r) => <li key={r}>• {ROLE_LABELS[r]}</li>)}
          </ul>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 font-semibold">Users</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="text-left px-4 py-2">User</th>
              <th className="text-left px-4 py-2">Department</th>
              <th className="text-left px-4 py-2">Permission Role</th>
              <th className="text-left px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {usersQ.data?.map((u: any) => (
              <tr key={u.id}>
                <td className="px-4 py-2">
                  <div className="font-medium">{u.full_name ?? u.email}</div>
                  <div className="text-xs text-slate-500">{u.email}{u.job_title ? ` · ${u.job_title}` : ""}</div>
                </td>
                <td className="px-4 py-2">
                  <select className="border border-slate-200 rounded px-2 py-1 text-sm"
                    value={u.department_id ?? ""}
                    onChange={(e) => updateProfile(u.id, { department_id: e.target.value || null })}>
                    <option value="">—</option>
                    {depsQ.data?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <div className="text-xs text-slate-500 mt-1">
                    Current: {u.departments?.name ?? "—"}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <select className="border border-slate-200 rounded px-2 py-1 text-sm"
                    value={u.roles[0] ?? "employee"}
                    onChange={(e) => setUserRole(u.id, e.target.value as AppRole)}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  <div className="text-xs text-slate-500 mt-1">
                    Current: {u.roles.map((r: AppRole) => ROLE_LABELS[r]).join(", ") || "—"}
                  </div>
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
  );
}
