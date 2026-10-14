-- ¿El usuario actual comparte alguna organización con `other`?
-- Se usa para que los miembros vean el perfil (nombre, email) de sus compañeros.
CREATE OR REPLACE FUNCTION public.shares_org_with(other uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.memberships mine
    JOIN public.memberships theirs ON theirs.organization_id = mine.organization_id
    WHERE mine.user_id = (SELECT auth.uid())
      AND theirs.user_id = other
  );
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.shares_org_with(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.shares_org_with(uuid) TO authenticated, service_role;
