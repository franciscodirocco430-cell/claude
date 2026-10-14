"use client";

import { Eye, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  enrollAction,
  previewAction,
  saveSequenceAction,
  sequenceStatusAction,
} from "@/app/(app)/campanas/[id]/secuencias/actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated } from "@/hooks/use-hydrated";
import { TEMPLATE_VARIABLES } from "@/server/email/template";
import { MAX_STEPS, type SequenceFormValues } from "@/server/sequences/schemas";

type Errors = Record<string, string>;
type Notice = { ok: boolean; text: string } | null;

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export interface SequenceEditorProps {
  campaignId: string;
  sequenceId?: string;
  initial: SequenceFormValues;
  mailboxes: { id: string; email: string; status: string }[];
  prospects: { id: string; label: string }[];
  status?: string;
  canManage: boolean;
}

export function SequenceEditor(props: SequenceEditorProps) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [values, setValues] = useState(props.initial);
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, startTransition] = useTransition();
  const [previewProspect, setPreviewProspect] = useState(props.prospects[0]?.id ?? "");
  const [preview, setPreview] = useState<{
    step: number;
    subject: string | null;
    body: string | null;
    missing: string[];
    to: string | null;
  } | null>(null);
  const steps = values.steps ?? [];
  const disabled = !hydrated || pending || !props.canManage;

  const setStep = (i: number, patch: Partial<(typeof steps)[number]>) =>
    setValues((v) => ({
      ...v,
      steps: (v.steps ?? []).map((s, j) => (j === i ? { ...s, ...patch } : s)),
    }));

  const run = (fn: () => Promise<{ status: string; message?: string; fieldErrors?: unknown }>) =>
    startTransition(async () => {
      const res = await fn();
      if (res.status === "error") {
        setNotice({ ok: false, text: res.message ?? "Algo salió mal." });
        setErrors((res.fieldErrors as Errors) ?? {});
      } else {
        setErrors({});
        setNotice(res.message ? { ok: true, text: res.message } : null);
        router.refresh();
      }
    });

  const showPreview = (index: number) =>
    startTransition(async () => {
      const step = steps[index];
      if (!step || !previewProspect) return;
      const res = await previewAction({
        campaignId: props.campaignId,
        prospectId: previewProspect,
        subject: step.subject ?? "",
        body: step.body ?? "",
        firstSubject: steps[0]?.subject ?? "",
      });
      if (res.status === "success") setPreview({ step: index, ...res.preview });
      else setNotice({ ok: false, text: res.message });
    });

  return (
    <div className="grid gap-4">
      <Card className="gap-4">
        <CardHeader>
          <CardTitle as="h2">Configuración</CardTitle>
          <CardDescription>
            Se envía desde la casilla elegida, en el horario indicado según la zona horaria de cada
            prospecto.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="seq-name">Nombre</Label>
            <Input
              id="seq-name"
              value={values.name ?? ""}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
              disabled={!props.canManage}
              aria-invalid={errors.name ? true : undefined}
            />
            {errors.name ? <p className="text-destructive text-sm">{errors.name}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="seq-mailbox">Casilla de Gmail</Label>
            <NativeSelect
              id="seq-mailbox"
              value={values.mailboxAccountId ?? ""}
              onChange={(e) => setValues({ ...values, mailboxAccountId: e.target.value || null })}
              disabled={!props.canManage}
            >
              <option value="">Elegí una casilla</option>
              {props.mailboxes.map((m) => (
                <option key={m.id} value={m.id} disabled={m.status !== "active"}>
                  {m.email}
                  {m.status !== "active" ? " (desconectada)" : ""}
                </option>
              ))}
            </NativeSelect>
            {props.mailboxes.length === 0 ? (
              <p className="text-muted-foreground text-xs">Conectá Gmail en Configuración.</p>
            ) : null}
          </div>
          <fieldset className="grid gap-2 sm:col-span-2">
            <legend className="mb-1 text-sm font-medium">
              Horario de envío (hora local del prospecto)
            </legend>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>De</span>
              <Input
                aria-label="Hora de inicio"
                type="number"
                min={0}
                max={23}
                className="w-20"
                value={String(values.sendStartHour ?? 9)}
                onChange={(e) =>
                  setValues({ ...values, sendStartHour: e.target.value as unknown as number })
                }
                disabled={!props.canManage}
              />
              <span>a</span>
              <Input
                aria-label="Hora de fin"
                type="number"
                min={1}
                max={24}
                className="w-20"
                value={String(values.sendEndHour ?? 18)}
                onChange={(e) =>
                  setValues({ ...values, sendEndHour: e.target.value as unknown as number })
                }
                disabled={!props.canManage}
              />
              <span>h</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d, i) => {
                const days = (values.sendDays ?? []) as number[];
                const on = days.includes(i);
                return (
                  <label
                    key={d}
                    className="flex items-center gap-1 rounded-md border px-2 py-1 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={on}
                      disabled={!props.canManage}
                      onChange={() =>
                        setValues({
                          ...values,
                          sendDays: on ? days.filter((x) => x !== i) : [...days, i],
                        })
                      }
                    />
                    {d}
                  </label>
                );
              })}
            </div>
            {errors.sendEndHour || errors.sendDays ? (
              <p className="text-destructive text-sm">{errors.sendEndHour ?? errors.sendDays}</p>
            ) : null}
          </fieldset>
        </CardContent>
      </Card>

      <details className="rounded-xl border p-4 text-sm">
        <summary className="cursor-pointer font-medium">Variables disponibles</summary>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {Object.entries(TEMPLATE_VARIABLES).map(([k, v]) => (
            <li key={k}>
              <code className="bg-muted rounded px-1">{`{{${k}}}`}</code> — {v}
            </li>
          ))}
        </ul>
        <p className="text-muted-foreground mt-2">
          Con valor por defecto: <code className="bg-muted rounded px-1">{"{{nombre|hola}}"}</code>.
          La firma y el link de baja se agregan solos al final de cada email.
        </p>
      </details>

      {steps.map((step, i) => (
        <Card key={i} className="gap-3">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle as="h2" className="text-base">
                {i === 0 ? "Email 1" : `Seguimiento ${i}`}
              </CardTitle>
              {i > 0 && props.canManage ? (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Quitar paso ${i + 1}`}
                  onClick={() => setValues({ ...values, steps: steps.filter((_, j) => j !== i) })}
                >
                  <Trash2 aria-hidden />
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="grid gap-3">
            {i > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>Esperar</span>
                <Input
                  aria-label={`Días de espera del paso ${i + 1}`}
                  type="number"
                  min={1}
                  max={30}
                  className="w-20"
                  value={String(step.delayDays ?? 1)}
                  onChange={(e) => setStep(i, { delayDays: e.target.value as unknown as number })}
                  disabled={!props.canManage}
                />
                <span>días desde el email anterior</span>
                {errors[`steps.${i}.delayDays`] ? (
                  <p className="text-destructive w-full text-sm">
                    {errors[`steps.${i}.delayDays`]}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="grid gap-1">
              <Label htmlFor={`subject-${i}`}>
                Asunto{i > 0 ? " (vacío = responde en el mismo hilo)" : ""}
              </Label>
              <Input
                id={`subject-${i}`}
                value={step.subject ?? ""}
                onChange={(e) => setStep(i, { subject: e.target.value })}
                disabled={!props.canManage}
                aria-invalid={errors[`steps.${i}.subject`] ? true : undefined}
              />
              {errors[`steps.${i}.subject`] ? (
                <p className="text-destructive text-sm">{errors[`steps.${i}.subject`]}</p>
              ) : null}
            </div>
            <div className="grid gap-1">
              <Label htmlFor={`body-${i}`}>Cuerpo</Label>
              <Textarea
                id={`body-${i}`}
                value={step.body ?? ""}
                onChange={(e) => setStep(i, { body: e.target.value })}
                className="min-h-28"
                disabled={!props.canManage}
                aria-invalid={errors[`steps.${i}.body`] ? true : undefined}
              />
              {errors[`steps.${i}.body`] ? (
                <p className="text-destructive text-sm">{errors[`steps.${i}.body`]}</p>
              ) : null}
            </div>
            {props.prospects.length ? (
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => showPreview(i)}
                disabled={!hydrated || pending}
              >
                <Eye aria-hidden /> Vista previa
              </Button>
            ) : null}
            {preview?.step === i ? (
              <div
                className="bg-muted/40 grid gap-2 rounded-lg border p-3 text-sm"
                aria-live="polite"
              >
                {preview.missing.length ? (
                  <p className="text-destructive">
                    Faltan datos para este prospecto:{" "}
                    {preview.missing.map((m) => `{{${m}}}`).join(", ")}. No se le enviaría.
                  </p>
                ) : (
                  <>
                    <p>
                      <span className="text-muted-foreground">Para:</span> {preview.to}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Asunto:</span> {preview.subject}
                    </p>
                    <p className="whitespace-pre-line">{preview.body}</p>
                  </>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}

      {props.prospects.length ? (
        <div className="grid gap-2 sm:max-w-sm">
          <Label htmlFor="preview-prospect">Prospecto para la vista previa</Label>
          <NativeSelect
            id="preview-prospect"
            value={previewProspect}
            onChange={(e) => setPreviewProspect(e.target.value)}
          >
            {props.prospects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      {props.canManage && steps.length < MAX_STEPS ? (
        <Button
          variant="outline"
          className="w-fit"
          onClick={() =>
            setValues({ ...values, steps: [...steps, { subject: "", body: "", delayDays: 3 }] })
          }
        >
          <Plus aria-hidden /> Agregar seguimiento
        </Button>
      ) : null}

      {notice ? <Alert variant={notice.ok ? "success" : "destructive"}>{notice.text}</Alert> : null}

      {props.canManage ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            disabled={disabled}
            onClick={() =>
              run(() =>
                saveSequenceAction({
                  campaignId: props.campaignId,
                  sequenceId: props.sequenceId,
                  values,
                }),
              )
            }
          >
            {pending ? "Guardando…" : "Guardar secuencia"}
          </Button>
          {props.sequenceId ? (
            <>
              {props.status === "active" ? (
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() =>
                    run(() =>
                      sequenceStatusAction({ sequenceId: props.sequenceId!, action: "pause" }),
                    )
                  }
                >
                  Pausar
                </Button>
              ) : (
                <Button
                  variant="outline"
                  disabled={disabled}
                  onClick={() =>
                    run(() =>
                      sequenceStatusAction({ sequenceId: props.sequenceId!, action: "activate" }),
                    )
                  }
                >
                  Activar
                </Button>
              )}
              <Button
                variant="secondary"
                disabled={disabled || props.status !== "active"}
                onClick={() => run(() => enrollAction({ sequenceId: props.sequenceId! }))}
              >
                Inscribir prospectos elegibles
              </Button>
            </>
          ) : null}
        </div>
      ) : (
        <Badge variant="outline" className="w-fit">
          Solo owners y admins pueden editar secuencias.
        </Badge>
      )}
    </div>
  );
}
