"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/forms/submit-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useRefreshOnSuccess } from "@/hooks/use-refresh-on-success";
import { idle, type ActionState } from "@/server/actions";
import type { SocialChannel } from "@/server/compliance/channels";
import {
  connectMockAccountAction,
  disconnectChannelAccountAction,
  setDefaultCampaignAction,
  simulateInboundAction,
} from "./channel-actions";

export const SOCIAL_LABELS: Record<SocialChannel, string> = {
  instagram: "Instagram",
  facebook: "Messenger",
  whatsapp: "WhatsApp",
  tiktok: "TikTok",
};

export interface ChannelAccountView {
  id: string;
  channel: SocialChannel;
  displayName: string | null;
  externalId: string;
  mock: boolean;
  defaultCampaignId: string | null;
}

function ActionMessage({ state }: { state: ActionState }) {
  if (state.status === "idle" || !state.message) return null;
  return (
    <p
      role="status"
      className={
        state.status === "error" ? "text-destructive text-xs" : "text-muted-foreground text-xs"
      }
    >
      {state.message}
    </p>
  );
}

export function ChannelAccountRow({
  account,
  canManage,
  campaigns,
}: {
  account: ChannelAccountView;
  canManage: boolean;
  campaigns: { id: string; name: string }[];
}) {
  const [campState, saveCampaign] = useActionState<ActionState, FormData>(
    setDefaultCampaignAction,
    idle,
  );
  const [discState, disconnect] = useActionState<ActionState, FormData>(
    disconnectChannelAccountAction,
    idle,
  );
  const [simState, simulate] = useActionState<ActionState, FormData>(simulateInboundAction, idle);
  useRefreshOnSuccess(discState);
  const label = SOCIAL_LABELS[account.channel];
  const isWhatsapp = account.channel === "whatsapp";

  return (
    <li className="grid gap-3 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{account.displayName ?? label}</p>
          <p className="text-muted-foreground truncate text-xs">
            {label} · {account.externalId}
          </p>
        </div>
        <Badge variant={account.mock ? "outline" : "secondary"}>
          {account.mock ? "Prueba" : "Conectada"}
        </Badge>
      </div>

      {canManage ? (
        <form action={saveCampaign} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="accountId" value={account.id} />
          <div className="grid min-w-0 flex-1 gap-1">
            <Label htmlFor={`campaign-${account.id}`}>Campaña para contactos nuevos</Label>
            <NativeSelect
              id={`campaign-${account.id}`}
              name="campaignId"
              defaultValue={account.defaultCampaignId ?? ""}
            >
              <option value="">Sin campaña (la IA no responde)</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <SubmitButton size="sm" variant="outline" pendingText="Guardando…">
            Guardar campaña
          </SubmitButton>
          <ActionMessage state={campState} />
        </form>
      ) : null}

      {canManage && account.mock ? (
        <details className="rounded-md border p-3">
          <summary className="cursor-pointer text-sm font-medium">Simular mensaje entrante</summary>
          <form action={simulate} className="mt-3 grid gap-3">
            <input type="hidden" name="accountId" value={account.id} />
            <input type="hidden" name="channel" value={account.channel} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <Label htmlFor={`contact-${account.id}`}>
                  {isWhatsapp ? "Teléfono de quien escribe" : "Usuario de quien escribe"}
                </Label>
                <Input
                  id={`contact-${account.id}`}
                  name="contact"
                  required
                  inputMode={isWhatsapp ? "tel" : "text"}
                  placeholder={isWhatsapp ? "+54 9 11 2345 6789" : "@clinica.sonrisas"}
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor={`name-${account.id}`}>Nombre (opcional)</Label>
                <Input id={`name-${account.id}`} name="name" placeholder="Laura Gómez" />
              </div>
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`text-${account.id}`}>Mensaje</Label>
              <Textarea
                id={`text-${account.id}`}
                name="text"
                required
                maxLength={1000}
                placeholder="Hola, vi tu publicación y quería consultar…"
                className="min-h-16"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <SubmitButton size="sm" variant="secondary" pendingText="Enviando…">
                Simular mensaje
              </SubmitButton>
              <ActionMessage state={simState} />
            </div>
          </form>
        </details>
      ) : null}

      {canManage ? (
        <form
          action={disconnect}
          onSubmit={(e) => {
            if (!confirm(`¿Desconectar ${account.displayName ?? label}?`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="accountId" value={account.id} />
          <SubmitButton size="sm" variant="ghost" pendingText="Desconectando…">
            Desconectar
          </SubmitButton>
          {discState.status === "error" ? <ActionMessage state={discState} /> : null}
        </form>
      ) : null}
    </li>
  );
}

export function ConnectMockAccountForm() {
  const [state, action] = useActionState<ActionState, FormData>(connectMockAccountAction, idle);
  useRefreshOnSuccess(state);
  return (
    <form action={action} className="grid gap-2 rounded-lg border border-dashed p-3">
      <p className="text-sm font-medium">Cuenta de prueba</p>
      <p className="text-muted-foreground text-xs">
        Solo en desarrollo: simula una cuenta conectada para probar mensajes entrantes sin una app
        aprobada.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1">
          <Label htmlFor="mock-channel">Canal</Label>
          <NativeSelect id="mock-channel" name="channel" defaultValue="instagram">
            {(Object.keys(SOCIAL_LABELS) as SocialChannel[]).map((c) => (
              <option key={c} value={c}>
                {SOCIAL_LABELS[c]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <SubmitButton size="sm" variant="outline" pendingText="Conectando…">
          Conectar cuenta de prueba
        </SubmitButton>
      </div>
      <ActionMessage state={state} />
    </form>
  );
}
