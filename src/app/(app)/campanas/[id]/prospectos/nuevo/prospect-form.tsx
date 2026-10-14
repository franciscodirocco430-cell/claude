"use client";

import { useActionState, useMemo, useState } from "react";
import { Field } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { Alert } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { idle, type ActionState } from "@/server/actions";
import { CHANNEL_LABELS, parseProfileInput } from "@/server/prospects/profile-url";
import { addProspectAction } from "../../../actions";

function describe(target: string): { ok: boolean; text: string } | null {
  if (!target.trim()) return null;
  const parsed = parseProfileInput(target);
  if (!parsed) return { ok: false, text: "No reconocemos ese link." };
  if (parsed.kind === "handle") {
    return { ok: true, text: `${CHANNEL_LABELS[parsed.channel]}: ${parsed.handle}` };
  }
  if (parsed.kind === "email") return { ok: true, text: `Email: ${parsed.email}` };
  return { ok: true, text: `Sitio web: ${parsed.url}` };
}

export function ProspectForm({ campaignId }: { campaignId: string }) {
  const [state, action] = useActionState<ActionState, FormData>(addProspectAction, idle);
  const values = state.status === "error" ? state.values : undefined;
  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const [target, setTarget] = useState(values?.target ?? "");
  const [optIn, setOptIn] = useState(values?.whatsappOptIn === "on");
  const detected = useMemo(() => describe(target), [target]);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <input type="hidden" name="campaignId" value={campaignId} />
      {state.status === "error" && state.message ? (
        <Alert variant="destructive">{state.message}</Alert>
      ) : null}
      <div className="grid gap-2">
        <Field
          label="Link del perfil, web o email"
          name="target"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="instagram.com/clinica · tiktok.com/@clinica · clinica.com.ar"
          error={errors?.target}
          autoComplete="off"
          inputMode="url"
        />
        {detected && !errors?.target ? (
          <p
            className={detected.ok ? "text-muted-foreground text-sm" : "text-destructive text-sm"}
            aria-live="polite"
          >
            {detected.ok ? `Detectado → ${detected.text}` : detected.text}
          </p>
        ) : null}
        <p className="text-muted-foreground text-xs">
          Solo guardamos el link: no entramos al perfil ni copiamos datos de la red.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre" name="fullName" defaultValue={values?.fullName} autoComplete="off" />
        <Field label="Empresa" name="company" defaultValue={values?.company} autoComplete="off" />
        <Field label="Rubro" name="industry" defaultValue={values?.industry} autoComplete="off" />
        <Field
          label="Email"
          name="email"
          type="email"
          inputMode="email"
          defaultValue={values?.email}
          autoComplete="off"
        />
        <Field
          label="Teléfono"
          name="phone"
          type="tel"
          inputMode="tel"
          defaultValue={values?.phone}
          hint="Con código de país, ej.: +54 9 11 2345 6789"
          autoComplete="off"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" name="notes" defaultValue={values?.notes} />
      </div>
      <fieldset className="grid gap-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">Consentimiento de WhatsApp</legend>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="whatsappOptIn"
            className="accent-primary mt-0.5 size-4"
            checked={optIn}
            onChange={(e) => setOptIn(e.target.checked)}
          />
          El prospecto aceptó recibir mensajes de WhatsApp de nuestra parte.
        </label>
        {optIn ? (
          <Field
            label="Fecha del consentimiento"
            name="whatsappOptInDate"
            type="date"
            defaultValue={values?.whatsappOptInDate}
            hint="Sin fecha no se registra el consentimiento."
          />
        ) : null}
      </fieldset>
      <SubmitButton className="w-full sm:w-fit" pendingText="Guardando…">
        Agregar prospecto
      </SubmitButton>
    </form>
  );
}
