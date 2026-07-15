
CREATE OR REPLACE FUNCTION public.is_office_services_user()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.departments d ON d.id = p.department_id
    WHERE p.id = auth.uid()
      AND lower(trim(d.name)) = 'office services'
  )
$$;

-- purchase_orders
DROP POLICY IF EXISTS "po select" ON public.purchase_orders;
DROP POLICY IF EXISTS "po manage" ON public.purchase_orders;
DROP POLICY IF EXISTS "po update" ON public.purchase_orders;
DROP POLICY IF EXISTS "po delete" ON public.purchase_orders;

CREATE POLICY "po select" ON public.purchase_orders FOR SELECT
USING (
  has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'office_services')
  OR public.is_office_services_user()
  OR (has_role(auth.uid(),'dept_head') AND (department_id IS NULL OR department_id = current_user_department()))
);
CREATE POLICY "po manage" ON public.purchase_orders FOR INSERT
WITH CHECK (
  has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'office_services') OR public.is_office_services_user()
);
CREATE POLICY "po update" ON public.purchase_orders FOR UPDATE
USING (
  has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'office_services') OR public.is_office_services_user()
);
CREATE POLICY "po delete" ON public.purchase_orders FOR DELETE
USING (
  has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'office_services') OR public.is_office_services_user()
);

-- cost_allocations
DROP POLICY IF EXISTS "alloc select dept" ON public.cost_allocations;
DROP POLICY IF EXISTS "alloc manage" ON public.cost_allocations;
DROP POLICY IF EXISTS "alloc update" ON public.cost_allocations;
DROP POLICY IF EXISTS "alloc delete" ON public.cost_allocations;

CREATE POLICY "alloc select dept" ON public.cost_allocations FOR SELECT
USING (
  has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'office_services')
  OR public.is_office_services_user()
  OR (has_role(auth.uid(),'dept_head') AND department_id = current_user_department())
);
CREATE POLICY "alloc manage" ON public.cost_allocations FOR INSERT
WITH CHECK (
  has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'office_services') OR public.is_office_services_user()
);
CREATE POLICY "alloc update" ON public.cost_allocations FOR UPDATE
USING (
  has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'office_services') OR public.is_office_services_user()
);
CREATE POLICY "alloc delete" ON public.cost_allocations FOR DELETE
USING (
  has_role(auth.uid(),'super_admin') OR has_role(auth.uid(),'office_services') OR public.is_office_services_user()
);
