import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Tables mirrored to the external Supabase (must match DB trigger list).
const MIRRORED_TABLES = [
  "departments",
  "job_titles",
  "profiles",
  "user_roles",
  "carts",
  "documents",
  "cart_approvals",
  "purchase_orders",
  "cost_allocations",
  "audit_log",
  "notifications",
] as const;

async function requireSuperAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "super_admin",
  });
  if (error || !data) throw new Error("Forbidden");
}

async function loadMirrorConfig(supabase: any) {
  const { data, error } = await supabase
    .from("app_settings")
    .select("mirror_enabled, mirror_url, mirror_service_key, mirror_db_url")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.mirror_url || !data?.mirror_service_key) {
    throw new Error("Mirror URL and service key are not configured.");
  }
  return {
    url: (data.mirror_url as string).replace(/\/$/, ""),
    key: data.mirror_service_key as string,
    enabled: !!data.mirror_enabled,
    dbUrl: (data.mirror_db_url as string | null) ?? null,
  };
}

async function autoDeploySchema(cfg: { dbUrl: string | null; url: string; key: string }) {
  if (!cfg.dbUrl) return { deployed: false, reason: "no_db_url" as const };
  const { runMirrorSchemaSql } = await import("./mirror-schema.server");
  await runMirrorSchemaSql(cfg.dbUrl);
  // Ask PostgREST to reload its schema cache so freshly created tables are visible.
  try {
    await fetch(`${cfg.url}/rest/v1/rpc/pgrst_watch`, {
      method: "POST",
      headers: mirrorHeaders(cfg.key),
    });
  } catch {
    // best effort
  }
  return { deployed: true as const };
}

function mirrorHeaders(key: string, extra: Record<string, string> = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

// --- Test connection ---
export const testMirror = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSuperAdmin(context.supabase, context.userId);
    const cfg = await loadMirrorConfig(context.supabase);
    const res = await fetch(`${cfg.url}/rest/v1/departments?select=id&limit=1`, {
      headers: mirrorHeaders(cfg.key),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`External DB responded ${res.status}: ${body.slice(0, 200)}`);
    }
    return { ok: true, status: res.status };
  });

// --- Deploy the mirror schema to the external DB (direct Postgres connection) ---
export const deployMirrorSchema = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSuperAdmin(context.supabase, context.userId);
    const cfg = await loadMirrorConfig(context.supabase);
    if (!cfg.dbUrl) {
      throw new Error(
        "Mirror database connection URL is not configured. Add the external project's Postgres connection string (Session pooler URI) to enable auto-deploy.",
      );
    }
    const { runMirrorSchemaSql } = await import("./mirror-schema.server");
    await runMirrorSchemaSql(cfg.dbUrl);
    // Nudge PostgREST to reload its schema cache.
    try {
      await fetch(`${cfg.url}/rest/v1/rpc/pgrst_watch`, {
        method: "POST",
        headers: mirrorHeaders(cfg.key),
      });
    } catch {
      // best effort
    }
    return { ok: true };
  });

// --- Full resync: auto-deploy schema, then upsert every row of every mirrored table ---
export const resyncMirror = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSuperAdmin(context.supabase, context.userId);
    const cfg = await loadMirrorConfig(context.supabase);
    const schemaResult = await autoDeploySchema(cfg);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const results: Record<string, { rows: number; ok: boolean; error?: string }> = {};

    for (const table of MIRRORED_TABLES) {
      const { data, error } = await supabaseAdmin.from(table).select("*");
      if (error) {
        results[table] = { rows: 0, ok: false, error: error.message };
        continue;
      }
      if (!data || data.length === 0) {
        results[table] = { rows: 0, ok: true };
        continue;
      }
      // chunk to avoid huge payloads
      const chunkSize = 200;
      let sent = 0;
      let err: string | undefined;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        const res = await fetch(`${cfg.url}/rest/v1/${table}`, {
          method: "POST",
          headers: mirrorHeaders(cfg.key, {
            Prefer: "resolution=merge-duplicates,return=minimal",
          }),
          body: JSON.stringify(chunk),
        });
        if (!res.ok) {
          err = `${res.status}: ${(await res.text()).slice(0, 200)}`;
          break;
        }
        sent += chunk.length;
      }
      results[table] = err
        ? { rows: sent, ok: false, error: err }
        : { rows: sent, ok: true };
    }
    return { results };
  });

// --- Retry failed rows ---
export const retryMirrorFailures = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireSuperAdmin(context.supabase, context.userId);
    const cfg = await loadMirrorConfig(context.supabase);
    const { data: failures, error } = await context.supabase
      .from("mirror_failures")
      .select("*")
      .is("resolved_at", null)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    let resolved = 0;
    for (const f of failures ?? []) {
      const table = (f as any).table_name as string;
      const op = (f as any).op as string;
      const payload = (f as any).payload;
      const rowId = (f as any).row_id;
      let res: Response;
      if (op === "DELETE") {
        res = await fetch(`${cfg.url}/rest/v1/${table}?id=eq.${rowId}`, {
          method: "DELETE",
          headers: mirrorHeaders(cfg.key),
        });
      } else {
        res = await fetch(`${cfg.url}/rest/v1/${table}`, {
          method: "POST",
          headers: mirrorHeaders(cfg.key, {
            Prefer: "resolution=merge-duplicates,return=minimal",
          }),
          body: JSON.stringify(payload),
        });
      }
      if (res.ok) {
        await context.supabase
          .from("mirror_failures")
          .update({ resolved_at: new Date().toISOString() })
          .eq("id", (f as any).id);
        resolved += 1;
      }
    }
    return { attempted: failures?.length ?? 0, resolved };
  });

// --- Mirror a storage file (called after PO upload) ---
export const mirrorStorageFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ bucket: z.string().min(1), path: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const cfg = await loadMirrorConfig(context.supabase);
    if (!cfg.enabled) return { skipped: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const dl = await supabaseAdmin.storage.from(data.bucket).download(data.path);
    if (dl.error || !dl.data) throw new Error(dl.error?.message ?? "download failed");
    const buf = await dl.data.arrayBuffer();
    const uploadUrl = `${cfg.url}/storage/v1/object/${data.bucket}/${data.path}`;
    const res = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": dl.data.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: buf,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`External storage ${res.status}: ${body.slice(0, 200)}`);
    }
    return { ok: true };
  });
