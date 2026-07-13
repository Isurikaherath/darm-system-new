
CREATE OR REPLACE FUNCTION public.has_any_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles) $$;
GRANT EXECUTE ON FUNCTION public.has_any_user() TO anon, authenticated;
