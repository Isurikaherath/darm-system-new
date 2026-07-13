
INSERT INTO public.profiles (id, full_name, email)
VALUES ('59cd129a-d304-4f7d-bb08-cd2820f6778f', 'Pasindu Thambugala', 'pasinduthambugala@gmail.com')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;

INSERT INTO public.user_roles (user_id, role)
VALUES ('59cd129a-d304-4f7d-bb08-cd2820f6778f', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;
