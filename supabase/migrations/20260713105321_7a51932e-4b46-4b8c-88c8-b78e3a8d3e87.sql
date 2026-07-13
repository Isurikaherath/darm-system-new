
-- 1. app_settings: restrict reads
DROP POLICY IF EXISTS "read settings" ON public.app_settings;
DROP POLICY IF EXISTS "admins read settings" ON public.app_settings;
CREATE POLICY "admins read settings" ON public.app_settings
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin')
    OR public.has_role(auth.uid(), 'office_services')
  );

-- 2. po-attachments storage: department-scoped
DROP POLICY IF EXISTS "po-attachments read" ON storage.objects;
DROP POLICY IF EXISTS "po-attachments insert" ON storage.objects;
DROP POLICY IF EXISTS "po-attachments update" ON storage.objects;
DROP POLICY IF EXISTS "po-attachments delete" ON storage.objects;
DROP POLICY IF EXISTS "po-attachments authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "po-attachments authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "po-attachments authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "po-attachments authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "po-attachments dept read" ON storage.objects;
DROP POLICY IF EXISTS "po-attachments dept insert" ON storage.objects;
DROP POLICY IF EXISTS "po-attachments dept update" ON storage.objects;
DROP POLICY IF EXISTS "po-attachments dept delete" ON storage.objects;

CREATE POLICY "po-attachments dept read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'po-attachments'
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'office_services')
      OR EXISTS (
        SELECT 1 FROM public.purchase_orders po
        WHERE po.id::text = (storage.foldername(name))[1]
          AND po.department_id = public.current_user_department()
      )
    )
  );

CREATE POLICY "po-attachments dept insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'po-attachments'
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'office_services')
      OR EXISTS (
        SELECT 1 FROM public.purchase_orders po
        WHERE po.id::text = (storage.foldername(name))[1]
          AND po.department_id = public.current_user_department()
      )
    )
  );

CREATE POLICY "po-attachments dept update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'po-attachments'
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'office_services')
      OR EXISTS (
        SELECT 1 FROM public.purchase_orders po
        WHERE po.id::text = (storage.foldername(name))[1]
          AND po.department_id = public.current_user_department()
      )
    )
  );

CREATE POLICY "po-attachments dept delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'po-attachments'
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'office_services')
      OR EXISTS (
        SELECT 1 FROM public.purchase_orders po
        WHERE po.id::text = (storage.foldername(name))[1]
          AND po.department_id = public.current_user_department()
      )
    )
  );

-- 3. cart_approvals: dept scope on insert
DROP POLICY IF EXISTS "approvals insert active" ON public.cart_approvals;
CREATE POLICY "approvals insert active" ON public.cart_approvals
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND public.current_user_is_active()
    AND (
      public.has_role(auth.uid(), 'super_admin')
      OR public.has_role(auth.uid(), 'office_services')
      OR EXISTS (
        SELECT 1 FROM public.carts c
        WHERE c.id = cart_approvals.cart_id
          AND c.department_id = public.current_user_department()
      )
    )
  );
