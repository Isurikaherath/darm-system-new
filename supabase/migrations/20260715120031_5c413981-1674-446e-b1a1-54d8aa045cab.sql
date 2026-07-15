
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'departments','job_titles','profiles','user_roles',
    'carts','documents','cart_approvals',
    'purchase_orders','cost_allocations','audit_log','notifications'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_mirror_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_mirror_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.mirror_change()',
      t, t
    );
  END LOOP;
END $$;
