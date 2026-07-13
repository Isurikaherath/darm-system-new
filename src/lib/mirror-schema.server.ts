// Embedded mirror schema — kept in sync with public/external-schema.sql.
// Used by deployMirrorSchema to auto-provision the external Supabase project
// via a direct Postgres connection before running any sync.

export const EXTERNAL_MIRROR_SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  theme_color text,
  created_at timestamptz,
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.job_titles (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  is_active boolean,
  department_id uuid,
  job_title text,
  created_at timestamptz,
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY,
  user_id uuid,
  role text
);

CREATE TABLE IF NOT EXISTS public.carts (
  id uuid PRIMARY KEY,
  cart_number text,
  department_id uuid,
  status text,
  retention_days integer,
  disposal_date date,
  retrieval_type text,
  requested_by uuid,
  requested_at timestamptz,
  approved_by uuid,
  approved_at timestamptz,
  reject_reason text,
  notes text,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY,
  document_name text,
  document_number text,
  retention_days integer,
  retention_years integer,
  cart_id uuid,
  file_number text,
  file_name text,
  department_id uuid,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.cart_approvals (
  id uuid PRIMARY KEY,
  cart_id uuid,
  kind text,
  actor_id uuid,
  decision text,
  reason text,
  created_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY,
  po_number text,
  po_type text,
  department_id uuid,
  amount numeric,
  box_count integer,
  unit_price numeric,
  period_start date,
  period_end date,
  description text,
  attachment_url text,
  attachment_name text,
  created_by uuid,
  created_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.cost_allocations (
  id uuid PRIMARY KEY,
  purchase_order_id uuid,
  department_id uuid,
  amount numeric,
  cart_count integer,
  notes text,
  created_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY,
  actor_id uuid,
  table_name text,
  record_id uuid,
  action text,
  details jsonb,
  created_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY,
  user_id uuid,
  kind text,
  title text,
  body text,
  data jsonb,
  read_at timestamptz,
  created_at timestamptz
);

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
`;

export async function runMirrorSchemaSql(dbUrl: string): Promise<void> {
  // postgres.js works on Cloudflare Workers with nodejs_compat (uses `net`).
  const postgresMod = await import("postgres");
  const postgres = (postgresMod as any).default ?? postgresMod;
  const sql = postgres(dbUrl, {
    ssl: "require",
    max: 1,
    idle_timeout: 5,
    connect_timeout: 15,
    prepare: false,
  });
  try {
    await sql.unsafe(EXTERNAL_MIRROR_SCHEMA_SQL);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
