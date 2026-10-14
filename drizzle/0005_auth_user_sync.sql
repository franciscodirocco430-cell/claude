-- Sincroniza public.profiles desde auth.users (alta y cambio de email/nombre).
CREATE OR REPLACE FUNCTION public.sync_profile_from_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    lower(NEW.email),
    nullif(NEW.raw_user_meta_data ->> 'full_name', '')
  )
  ON CONFLICT (id) DO UPDATE
    SET email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.sync_profile_from_auth_user() FROM PUBLIC;
--> statement-breakpoint
DROP TRIGGER IF EXISTS on_auth_user_synced ON auth.users;
--> statement-breakpoint
CREATE TRIGGER on_auth_user_synced
  AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_from_auth_user();
--> statement-breakpoint
-- Backfill de usuarios existentes.
INSERT INTO public.profiles (id, email, full_name)
SELECT u.id, lower(u.email), nullif(u.raw_user_meta_data ->> 'full_name', '')
FROM auth.users u
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint
-- Triggers de updated_at para las tablas nuevas (mismo bloque que 0002).
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables tb
      ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'updated_at'
      AND tb.table_type = 'BASE TABLE'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t.table_name);
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
      t.table_name
    );
  END LOOP;
END;
$$;
