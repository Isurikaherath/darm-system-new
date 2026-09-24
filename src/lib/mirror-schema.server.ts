// Embedded mirror schema — kept in sync with public/external-schema.sql.
// Used by deployMirrorSchema to auto-provision the external Supabase project
// via a direct Postgres connection before running any sync.

export const EXTERNAL_MIRROR_SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. departments
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  theme_color text,
  created_at timestamptz,
  updated_at timestamptz
);
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS theme_color text;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.departments DISABLE ROW LEVEL SECURITY;

-- 2. job_titles
CREATE TABLE IF NOT EXISTS public.job_titles (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz
);
ALTER TABLE public.job_titles ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.job_titles DISABLE ROW LEVEL SECURITY;

-- 3. profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  department_id uuid,
  is_active boolean DEFAULT true,
  job_title text,
  created_at timestamptz,
  updated_at timestamptz
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_title text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 4. user_roles
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  role text
);
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

-- 5. carts
CREATE TABLE IF NOT EXISTS public.carts (
  id uuid PRIMARY KEY,
  cart_number text,
  department_id uuid,
  status text,
  retention_days integer,
  disposal_date date,
  retrieval_type text,
  rejection_reason text,
  created_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  stored_at timestamptz,
  retrieved_at timestamptz,
  disposal_alert_sent boolean DEFAULT false,
  storage_notified_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);
ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS stored_at timestamptz;
ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS retrieved_at timestamptz;
ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS disposal_alert_sent boolean DEFAULT false;
ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS storage_notified_at timestamptz;
ALTER TABLE public.carts ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.carts DISABLE ROW LEVEL SECURITY;

-- 6. documents
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY,
  cart_id uuid,
  document_name text,
  document_number text,
  retention_period integer,
  file_number text,
  file_name text,
  department_id uuid,
  created_by uuid,
  created_at timestamptz,
  registration_date timestamptz
);
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS retention_period integer;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_number text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS registration_date timestamptz;
ALTER TABLE public.documents DISABLE ROW LEVEL SECURITY;

-- 7. cart_approvals
CREATE TABLE IF NOT EXISTS public.cart_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id uuid,
  action text,
  actor_id uuid,
  comments text,
  created_at timestamptz
);
ALTER TABLE public.cart_approvals ADD COLUMN IF NOT EXISTS action text;
ALTER TABLE public.cart_approvals ADD COLUMN IF NOT EXISTS comments text;
ALTER TABLE public.cart_approvals DISABLE ROW LEVEL SECURITY;

-- 8. purchase_orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id uuid PRIMARY KEY,
  po_number text,
  po_type text,
  amount numeric,
  period_start date,
  period_end date,
  description text,
  department_id uuid,
  created_by uuid,
  created_at timestamptz,
  attachment_url text,
  attachment_name text,
  box_count integer,
  unit_price numeric
);
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS attachment_url text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS attachment_name text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS box_count integer;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS unit_price numeric;
ALTER TABLE public.purchase_orders DISABLE ROW LEVEL SECURITY;

-- 9. cost_allocations
CREATE TABLE IF NOT EXISTS public.cost_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid,
  department_id uuid,
  amount numeric,
  cart_count integer,
  notes text,
  created_at timestamptz
);
ALTER TABLE public.cost_allocations DISABLE ROW LEVEL SECURITY;

-- 10. audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  table_name text,
  record_id text,
  action text,
  details jsonb,
  created_at timestamptz
);
ALTER TABLE public.audit_log DISABLE ROW LEVEL SECURITY;

-- 11. notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text,
  recipient text,
  department_id uuid,
  subject text,
  body text,
  payload jsonb,
  sent_at timestamptz
);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS recipient text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS department_id uuid;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS body text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS payload jsonb;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS sent_at timestamptz;
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
`;

export async function runMirrorSchemaSql(dbUrl: string): Promise<void> {
  // postgres.js works on Cloudflare Workers with nodejs_compat (uses \`net\`).
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
