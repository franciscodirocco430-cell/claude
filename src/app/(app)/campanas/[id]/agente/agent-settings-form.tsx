"use client";

import { Loader2 } from "lucide-react";
import { startTransition, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated } from "@/hooks/use-hydrated";
import { useRefreshOnSuccess } from "@/hooks/use-refresh-on-success";
import { idle, type ActionState } from "@/server/actions";
import type { AgentSettings } from "@/server/agent/settings";
import { saveAgentSettingsAction } from "./actions";

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function NumberField({
  name,
  label,
  value,
  min,
  max,
  hint,
}: {
  name: keyof AgentSettings;
  label: string;
  value: number;
  min: number;
  max: number;
  hint?: string;
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        defaultValue={value}
      />
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

export function AgentSettingsForm({
  campaignId,
  settings,
  calendars,
  hasQuestions,
  bookingUrl,
}: {
  campaignId: string;
  settings: AgentSettings;
  calendars: { id: string; email: string | null }[];
  hasQuestions: boolean;
  bookingUrl: string | null;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveAgentSettingsAction,
    idle,
  );
  useRefreshOnSuccess(state);
  const hydrated = useHydrated();

  return (
    <form
      className="grid gap-6"
      // Envío manual: así un error no borra lo que la persona escribió.
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <input type="hidden" name="campaignId" value={campaignId} />

      <section className="grid gap-3 rounded-lg border p-4">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={settings.enabled}
            className="mt-1 size-4"
          />
          <span className="grid gap-1">
            <span className="text-sm font-medium">Agente activo</span>
            <span className="text-muted-foreground text-xs">
              Responde mensajes entrantes de Instagram, Messenger, WhatsApp y TikTok dentro de la
              ventana de cada plataforma. Si alguien pregunta, dice que es una IA y ofrece pasar con
              una persona.
            </span>
          </span>
        </label>
        {!hasQuestions ? (
          <p className="text-destructive text-sm">
            La campaña no tiene preguntas de calificación: el agente no va a poder calificar.
          </p>
        ) : null}
        <div className="grid gap-1">
          <Label htmlFor="script">Guion e indicaciones (opcional)</Label>
          <Textarea
            id="script"
            name="script"
            maxLength={2000}
            defaultValue={settings.script}
            placeholder="Ej.: si preguntan precio, explicá que depende del tamaño de la clínica y que lo vemos en la llamada."
            className="min-h-24"
          />
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Ritmo y calificación</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField
            name="replyDelayMinSeconds"
            label="Demora mínima (seg.)"
            value={settings.replyDelayMinSeconds}
            min={0}
            max={3600}
          />
          <NumberField
            name="replyDelayMaxSeconds"
            label="Demora máxima (seg.)"
            value={settings.replyDelayMaxSeconds}
            min={0}
            max={3600}
            hint="Cada respuesta espera un tiempo al azar entre ambas."
          />
          <NumberField
            name="qualifyScore"
            label="Puntaje para calificar"
            value={settings.qualifyScore}
            min={0}
            max={100}
            hint="Debajo de esto, pasa a una persona."
          />
        </div>
      </section>

      <section className="grid gap-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">Agenda</h2>
        <div className="grid gap-1">
          <Label htmlFor="calendarAccountId">Calendario de Google</Label>
          <NativeSelect
            id="calendarAccountId"
            name="calendarAccountId"
            defaultValue={settings.calendarAccountId ?? ""}
          >
            <option value="">
              {bookingUrl
                ? "Sin calendario (mandar el link de agenda)"
                : "Sin calendario (pasa a una persona)"}
            </option>
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.email}
              </option>
            ))}
          </NativeSelect>
          {calendars.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              Conectá Google Calendar desde Configuración para ofrecer horarios reales.
            </p>
          ) : null}
        </div>
        <div className="grid gap-1">
          <Label htmlFor="meetingTitle">Título del evento</Label>
          <Input id="meetingTitle" name="meetingTitle" defaultValue={settings.meetingTitle} />
          <p className="text-muted-foreground text-xs">
            {"{{nombre}}"} se reemplaza por el prospecto.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <NumberField
            name="meetingDurationMinutes"
            label="Duración (min.)"
            value={settings.meetingDurationMinutes}
            min={15}
            max={180}
          />
          <NumberField
            name="meetingStartHour"
            label="Desde (hora)"
            value={settings.meetingStartHour}
            min={0}
            max={23}
          />
          <NumberField
            name="meetingEndHour"
            label="Hasta (hora)"
            value={settings.meetingEndHour}
            min={1}
            max={24}
          />
          <NumberField
            name="minNoticeHours"
            label="Anticipación mínima (h)"
            value={settings.minNoticeHours}
            min={0}
            max={168}
          />
          <NumberField
            name="bookingWindowDays"
            label="Hasta cuántos días adelante"
            value={settings.bookingWindowDays}
            min={1}
            max={30}
          />
        </div>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Días</legend>
          <div className="flex flex-wrap gap-3">
            {DAYS.map((d, i) => (
              <label key={d} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  name="meetingDays"
                  value={i}
                  defaultChecked={settings.meetingDays.includes(i)}
                  className="size-4"
                />
                {d}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!hydrated || pending} aria-busy={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        {state.status !== "idle" && state.message ? (
          <p
            role="status"
            className={
              state.status === "error"
                ? "text-destructive text-sm"
                : "text-muted-foreground text-sm"
            }
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
