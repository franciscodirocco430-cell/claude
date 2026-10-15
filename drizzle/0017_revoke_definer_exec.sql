-- Supabase da EXECUTE a anon/authenticated por defecto en las funciones de public, y
-- las expone por /rest/v1/rpc. Visitantes sin sesión no ejecutan ninguna; las de
-- triggers no las ejecuta nadie directo. Las de RLS siguen para authenticated
-- (las políticas las necesitan).
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid) FROM anon;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid) FROM anon;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.shares_org_with(uuid) FROM anon;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.sync_profile_from_auth_user() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.record_lead_stage_event() FROM PUBLIC, anon, authenticated;
