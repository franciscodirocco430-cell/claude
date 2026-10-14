import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { withUserContext } from "@/db/rls";
import { requireAppContext } from "@/server/auth/session";
import { getCampaign } from "@/server/campaigns/service";
import { getDb } from "@/server/db";

/** Carga la campaña de la organización activa (con RLS) o devuelve 404. */
export async function loadCampaign(id: string) {
  const ctx = await requireAppContext();
  if (!z.uuid().safeParse(id).success) notFound();
  const campaign = await withUserContext(getDb(), { sub: ctx.user.id }, (tx) =>
    getCampaign(tx, ctx.organizationId, id),
  );
  if (!campaign) notFound();
  return { ctx, campaign };
}
