import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, User, Lock, ArrowRight, FolderClosed, FileText, Cloud, ShieldCheck, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import bgAsset from "@/assets/darms-bg.jpg.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — DARMS" }] }),
  component: AuthPage,
});

function PasswordInput({
  id, value, onChange, minLength, placeholder,
}: { id: string; value: string; onChange: (v: string) => void; minLength?: number; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={minLength}
        placeholder={placeholder}
        className="pl-10 pr-10 h-11 bg-slate-50/60 border-slate-200"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-700"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function BrandIllustration() {
  return (
    <div className="relative w-full max-w-md aspect-square">
      {/* floating circles */}
      <div className="absolute top-6 left-8 w-3 h-3 rounded-full bg-white/60" />
      <div className="absolute top-20 right-10 w-2 h-2 rounded-full bg-white/50" />
      <div className="absolute bottom-16 left-16 w-4 h-4 rounded-full bg-white/40" />
      <div className="absolute bottom-8 right-24 w-2.5 h-2.5 rounded-full bg-white/50" />

      {/* Cloud */}
      <div className="absolute top-4 right-6 bg-white/90 rounded-2xl p-4 shadow-lg shadow-sky-900/10 backdrop-blur">
        <Cloud className="w-10 h-10 text-sky-500" strokeWidth={1.5} />
      </div>

      {/* Big folder */}
      <div className="absolute left-4 top-24 w-64 h-44 bg-gradient-to-br from-sky-400 to-blue-500 rounded-2xl shadow-xl shadow-blue-900/20 rotate-[-6deg] p-5 flex flex-col justify-end">
        <div className="absolute -top-3 left-5 h-4 w-24 rounded-t-lg bg-sky-400" />
        <div className="space-y-2">
          <div className="h-2 w-32 bg-white/70 rounded-full" />
          <div className="h-2 w-24 bg-white/50 rounded-full" />
        </div>
      </div>

      {/* Document */}
      <div className="absolute right-6 top-40 w-40 h-52 bg-white rounded-xl shadow-xl shadow-slate-900/10 p-4 rotate-[8deg]">
        <FileText className="w-6 h-6 text-blue-500 mb-3" strokeWidth={1.5} />
        <div className="space-y-2">
          <div className="h-1.5 w-full bg-slate-200 rounded-full" />
          <div className="h-1.5 w-3/4 bg-slate-200 rounded-full" />
          <div className="h-1.5 w-5/6 bg-slate-200 rounded-full" />
          <div className="h-1.5 w-2/3 bg-slate-200 rounded-full" />
        </div>
      </div>

      {/* Lock */}
      <div className="absolute bottom-6 left-10 bg-white rounded-2xl p-4 shadow-xl shadow-blue-900/10 border border-sky-100">
        <ShieldCheck className="w-8 h-8 text-blue-600" strokeWidth={1.8} />
      </div>

      {/* Small folder */}
      <div className="absolute bottom-14 right-10 w-20 h-14 bg-gradient-to-br from-sky-300 to-sky-400 rounded-lg shadow-lg rotate-[10deg]">
        <div className="absolute -top-1.5 left-2 h-2 w-10 rounded-t bg-sky-300" />
      </div>
    </div>
  );
}

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [department, setDepartment] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const hasUsersQ = useQuery({
    queryKey: ["has-any-user"],
    queryFn: async () => (await supabase.rpc("has_any_user")).data ?? false,
  });
  const isFirstUser = hasUsersQ.data === false;

  const depsQ = useQuery({
    queryKey: ["public-departments"],
    enabled: !isFirstUser,
    queryFn: async () => (await supabase.from("departments").select("id,name").order("name")).data ?? [],
  });
  const jobsQ = useQuery({
    queryKey: ["public-job-titles"],
    enabled: !isFirstUser,
    queryFn: async () => (await supabase.from("job_titles").select("id,name").order("name")).data ?? [],
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (password !== confirmPassword) throw new Error("Passwords do not match");
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, employee_id: employeeId, department, job_title: jobTitle },
          },
        });
        if (error) throw error;
        toast.success("Account created. Awaiting admin activation if you are not the first user.");
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-white">
      {/* LEFT: illustration */}
      <div className="relative hidden lg:flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-sky-100 via-blue-50 to-slate-100 p-12">
        <div className="absolute inset-0 opacity-60 bg-[radial-gradient(circle_at_20%_20%,rgba(59,110,165,0.15),transparent_50%),radial-gradient(circle_at_80%_70%,rgba(125,211,252,0.25),transparent_55%)]" />
        <div className="relative z-10 flex flex-col items-center gap-10">
          <BrandIllustration />
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-slate-800">Your documents, beautifully organized.</h2>
            <p className="mt-3 text-sm tracking-[0.25em] uppercase text-slate-500">
              Secure · Organized · Collaborative
            </p>
          </div>
        </div>
      </div>

      {/* RIGHT: form */}
      <div className="flex items-center justify-center px-6 py-10 sm:px-12 bg-white">
        <div className="w-full max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-50 border border-sky-100 text-sky-700 text-xs font-medium mb-8">
            <FolderClosed className="w-3.5 h-3.5" />
            FileVault
          </div>

          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            {mode === "signin" ? "Welcome to FileVault" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {mode === "signin"
              ? "Sign in to collaborate with your team and access your secure archive."
              : "Join your team's secure document workspace in seconds."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-slate-700">Full name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="pl-10 h-11 bg-slate-50/60 border-slate-200" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="employeeId" className="text-slate-700">Employee ID</Label>
                  <Input id="employeeId" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required className="h-11 bg-slate-50/60 border-slate-200" />
                </div>
                {!isFirstUser && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="department" className="text-slate-700">Department</Label>
                      <select id="department" value={department} onChange={(e) => setDepartment(e.target.value)} required className="w-full h-11 border border-slate-200 bg-slate-50/60 rounded-md px-3 text-sm">
                        <option value="">Select</option>
                        {depsQ.data?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="role" className="text-slate-700">Role</Label>
                      <select id="role" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} required className="w-full h-11 border border-slate-200 bg-slate-50/60 rounded-md px-3 text-sm">
                        <option value="">Select</option>
                        {jobsQ.data?.map((j: any) => <option key={j.id} value={j.name}>{j.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-700">Username or email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" className="pl-10 h-11 bg-slate-50/60 border-slate-200" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-slate-700">Password</Label>
              <PasswordInput id="password" value={password} onChange={setPassword} minLength={6} placeholder="••••••••" />
            </div>

            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-slate-700">Confirm password</Label>
                <PasswordInput id="confirmPassword" value={confirmPassword} onChange={setConfirmPassword} minLength={6} placeholder="••••••••" />
              </div>
            )}

            {mode === "signin" && (
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
                  Remember me
                </label>
                <button type="button" className="text-sm text-[#3b6ea5] hover:underline font-medium">
                  Forgot password?
                </button>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="group w-full h-11 mt-2 text-white font-semibold shadow-lg shadow-blue-500/30 border-0 bg-gradient-to-r from-[#3b6ea5] to-sky-500 hover:from-[#325d8c] hover:to-sky-600"
            >
              {loading ? "Please wait…" : (
                <span className="inline-flex items-center gap-2">
                  {mode === "signin" ? "Login" : "Create account"}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-6 text-sm text-center text-slate-600">
            {mode === "signin" ? (
              <>Don't have an account?{" "}
                <button type="button" onClick={() => setMode("signup")} className="text-[#3b6ea5] font-semibold hover:underline">Create an account</button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button type="button" onClick={() => setMode("signin")} className="text-[#3b6ea5] font-semibold hover:underline">Sign in</button>
              </>
            )}
          </div>

          <p className="text-xs text-slate-400 mt-8 text-center">
            The first user to register becomes the Super Admin automatically.
          </p>
        </div>
      </div>
    </div>
  );
}
