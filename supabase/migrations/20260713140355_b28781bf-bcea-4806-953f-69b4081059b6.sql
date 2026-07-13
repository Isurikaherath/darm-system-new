
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS sender_email text,
  ADD COLUMN IF NOT EXISTS sender_name text,
  ADD COLUMN IF NOT EXISTS smtp_host text,
  ADD COLUMN IF NOT EXISTS smtp_port integer,
  ADD COLUMN IF NOT EXISTS smtp_username text,
  ADD COLUMN IF NOT EXISTS smtp_password text,
  ADD COLUMN IF NOT EXISTS smtp_secure boolean DEFAULT true;

INSERT INTO public.app_settings (id, sender_email, sender_name)
VALUES (true, 'pasinduthambugala@gmail.com', 'DARMS')
ON CONFLICT (id) DO UPDATE
  SET sender_email = COALESCE(public.app_settings.sender_email, EXCLUDED.sender_email),
      sender_name  = COALESCE(public.app_settings.sender_name,  EXCLUDED.sender_name);
