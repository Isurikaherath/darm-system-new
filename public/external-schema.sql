-- DARMS backup schema: exact copy of the app database tables.
-- Run in the backup project's SQL editor. Recreates the backup tables (existing backup rows are removed; they will be re-copied).

DROP TABLE IF EXISTS public.departments CASCADE;
CREATE TABLE public.departments (
  id uuid PRIMARY KEY,
  name text,
  created_at timestamp with time zone,
  theme_color text
);
ALTER TABLE public.departments DISABLE ROW LEVEL SECURITY;

DROP TABLE IF EXISTS public.job_titles CASCADE;
CREATE TABLE public.job_titles (
  id uuid PRIMARY KEY,
  name text,
  created_at timestamp with time zone
);
ALTER TABLE public.job_titles DISABLE ROW LEVEL SECURITY;

DROP TABLE IF EXISTS public.profiles CASCADE;
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  department_id uuid,
  is_active boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  job_title text
);
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

DROP TABLE IF EXISTS public.user_roles CASCADE;
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY,
  user_id uuid,
  role text
);
ALTER TABLE public.user_roles DISABLE ROW LEVEL SECURITY;

DROP TABLE IF EXISTS public.carts CASCADE;
CREATE TABLE public.carts (
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
  approved_at timestamp with time zone,
  stored_at timestamp with time zone,
  retrieved_at timestamp with time zone,
  disposal_alert_sent boolean,
  storage_notified_at timestamp with time zone,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
);
ALTER TABLE public.carts DISABLE ROW LEVEL SECURITY;

DROP TABLE IF EXISTS public.documents CASCADE;
CREATE TABLE public.documents (
  id uuid PRIMARY KEY,
  cart_id uuid,
  document_name text,
  document_number text,
  retention_period integer,
  file_number text,
  file_name text,
  department_id uuid,
  created_by uuid,
  created_at timestamp with time zone,
  registration_date timestamp without time zone
);
ALTER TABLE public.documents DISABLE ROW LEVEL SECURITY;

DROP TABLE IF EXISTS public.cart_approvals CASCADE;
CREATE TABLE public.cart_approvals (
  id uuid PRIMARY KEY,
  cart_id uuid,
  action text,
  actor_id uuid,
  comments text,
  created_at timestamp with time zone
);
ALTER TABLE public.cart_approvals DISABLE ROW LEVEL SECURITY;

DROP TABLE IF EXISTS public.purchase_orders CASCADE;
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY,
  po_number text,
  po_type text,
  amount numeric,
  period_start date,
  period_end date,
  description text,
  department_id uuid,
  created_by uuid,
  created_at timestamp with time zone,
  attachment_url text,
  attachment_name text,
  box_count integer,
  unit_price numeric
);
ALTER TABLE public.purchase_orders DISABLE ROW LEVEL SECURITY;

DROP TABLE IF EXISTS public.cost_allocations CASCADE;
CREATE TABLE public.cost_allocations (
  id uuid PRIMARY KEY,
  purchase_order_id uuid,
  department_id uuid,
  amount numeric,
  cart_count integer,
  notes text,
  created_at timestamp with time zone
);
ALTER TABLE public.cost_allocations DISABLE ROW LEVEL SECURITY;

DROP TABLE IF EXISTS public.audit_log CASCADE;
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY,
  actor_id uuid,
  table_name text,
  record_id uuid,
  action text,
  details jsonb,
  created_at timestamp with time zone
);
ALTER TABLE public.audit_log DISABLE ROW LEVEL SECURITY;

DROP TABLE IF EXISTS public.notifications CASCADE;
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY,
  type text,
  recipient text,
  department_id uuid,
  subject text,
  body text,
  payload jsonb,
  sent_at timestamp with time zone
);
ALTER TABLE public.notifications DISABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
