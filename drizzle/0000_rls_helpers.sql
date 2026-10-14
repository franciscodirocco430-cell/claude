-- Helpers de RLS multi-tenant.
-- SECURITY DEFINER: consultan memberships sin disparar sus propias políticas
-- (evita recursión infinita). search_path vacío para no ser secuestrables.
-- plpgsql: el cuerpo se valida al ejecutarse, así que pueden crearse antes que las tablas.

CREATE OR REPLACE FUNCTION public.is_org_member(org uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.organization_id = org
      AND m.user_id = (SELECT auth.uid())
  );
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.is_org_admin(org uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.organization_id = org
      AND m.user_id = (SELECT auth.uid())
      AND m.role::text IN ('owner', 'admin')
  );
END;
$$;
--> statement-breakpoint

REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.is_org_admin(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated, service_role;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated, service_role;
--> statement-breakpoint

-- Mantiene updated_at aunque la escritura venga de supabase-js y no de Drizzle.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
