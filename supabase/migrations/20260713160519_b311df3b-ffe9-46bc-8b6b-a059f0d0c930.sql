
-- 1. Mirror config on app_settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS mirror_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mirror_url text,
  ADD COLUMN IF NOT EXISTS mirror_service_key text;

-- 2. Failure log
CREATE TABLE IF NOT EXISTS public.mirror_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  op text NOT NULL,
  row_id text,
  payload jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mirror_failures TO authenticated;
GRANT ALL ON public.mirror_failures TO service_role;
ALTER TABLE public.mirror_failures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "superadmin mirror_failures" ON public.mirror_failures
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'super_admin'))
  WITH CHECK (public.has_role(auth.uid(),'super_admin'));

-- 3. Mirror trigger function
CREATE OR REPLACE FUNCTION public.mirror_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s_enabled boolean;
  s_url text;
  s_key text;
  target_url text;
  row_id text;
  payload jsonb;
BEGIN
  SELECT mirror_enabled, mirror_url, mirror_service_key
    INTO s_enabled, s_url, s_key
  FROM public.app_settings LIMIT 1;

  IF s_enabled IS NOT TRUE OR s_url IS NULL OR s_key IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  s_url := rtrim(s_url, '/');

  BEGIN
    IF TG_OP = 'DELETE' THEN
      row_id := (to_jsonb(OLD) ->> 'id');
      target_url := s_url || '/rest/v1/' || TG_TABLE_NAME || '?id=eq.' || row_id;
      PERFORM net.http_delete(
        url := target_url,
        headers := jsonb_build_object(
          'apikey', s_key,
          'Authorization', 'Bearer ' || s_key
        )
      );
    ELSE
      payload := to_jsonb(NEW);
      PERFORM net.http_post(
        url := s_url || '/rest/v1/' || TG_TABLE_NAME,
        headers := jsonb_build_object(
          'apikey', s_key,
          'Authorization', 'Bearer ' || s_key,
          'Content-Type', 'application/json',
          'Prefer', 'resolution=merge-duplicates,return=minimal'
        ),
        body := payload
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.mirror_failures (table_name, op, row_id, payload, error)
    VALUES (
      TG_TABLE_NAME, TG_OP,
      COALESCE((to_jsonb(NEW) ->> 'id'), (to_jsonb(OLD) ->> 'id')),
      COALESCE(to_jsonb(NEW), to_jsonb(OLD)),
      SQLERRM
    );
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4. Attach trigger to every mirrored table
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'departments','job_titles','profiles','user_roles',
    'carts','documents','cart_approvals',
    'purchase_orders','cost_allocations',
    'audit_log','notifications'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_mirror_%1$s ON public.%1$I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_mirror_%1$s AFTER INSERT OR UPDATE OR DELETE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.mirror_change()',
      t
    );
  END LOOP;
END $$;
