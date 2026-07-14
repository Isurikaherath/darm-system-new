
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill missing profiles for existing auth users
DO $$
DECLARE
  u record;
  dept_meta text;
  dept_uuid uuid;
BEGIN
  FOR u IN SELECT au.* FROM auth.users au LEFT JOIN public.profiles p ON p.id=au.id WHERE p.id IS NULL LOOP
    dept_meta := u.raw_user_meta_data->>'department';
    dept_uuid := NULL;
    IF dept_meta IS NOT NULL AND dept_meta <> '' THEN
      BEGIN dept_uuid := dept_meta::uuid;
      EXCEPTION WHEN others THEN
        SELECT id INTO dept_uuid FROM public.departments WHERE name = dept_meta LIMIT 1;
      END;
    END IF;
    INSERT INTO public.profiles (id, email, full_name, is_active, department_id, job_title)
    VALUES (u.id, u.email,
      COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email,'@',1)),
      false, dept_uuid, u.raw_user_meta_data->>'job_title');
    INSERT INTO public.user_roles (user_id, role) VALUES (u.id, 'employee')
      ON CONFLICT DO NOTHING;
  END LOOP;
END $$;
