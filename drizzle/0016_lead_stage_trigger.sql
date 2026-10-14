-- Historial de etapas: cada alta o cambio de etapa en lead_scores deja un evento.
-- SECURITY DEFINER: lo escribe la base aunque el cambio venga de un usuario con RLS
-- (los usuarios no pueden insertar eventos a mano). actor = auth.uid() (null si es
-- el worker o el servidor sin sesión).
CREATE OR REPLACE FUNCTION public.record_lead_stage_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    INSERT INTO public.lead_stage_events
      (organization_id, lead_score_id, prospect_id, campaign_id, stage_id, stage_key, actor_user_id, at)
    SELECT NEW.organization_id, NEW.id, NEW.prospect_id, NEW.campaign_id, NEW.stage_id, s.key,
           auth.uid(), now()
    FROM public.pipeline_stages s
    WHERE s.id = NEW.stage_id;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS lead_stage_events_trg ON public.lead_scores;
--> statement-breakpoint
CREATE TRIGGER lead_stage_events_trg
AFTER INSERT OR UPDATE OF stage_id ON public.lead_scores
FOR EACH ROW EXECUTE FUNCTION public.record_lead_stage_event();
--> statement-breakpoint
-- Backfill APROXIMADO: antes no había historial; se toma la etapa actual con la
-- fecha de la última modificación del lead.
INSERT INTO public.lead_stage_events
  (organization_id, lead_score_id, prospect_id, campaign_id, stage_id, stage_key, actor_user_id, at)
SELECT ls.organization_id, ls.id, ls.prospect_id, ls.campaign_id, ls.stage_id, s.key, NULL, ls.updated_at
FROM public.lead_scores ls
JOIN public.pipeline_stages s ON s.id = ls.stage_id
WHERE NOT EXISTS (SELECT 1 FROM public.lead_stage_events e WHERE e.lead_score_id = ls.id);
