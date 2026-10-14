"use client";

import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { saveCampaignAction } from "@/app/(app)/campanas/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated } from "@/hooks/use-hydrated";
import { cn } from "@/lib/utils";
import {
  CHANNELS,
  DEFAULT_DAILY_LIMITS,
  issuesByPath,
  MAX_DAILY_LIMIT,
  WIZARD_STEPS,
  type CampaignChannel,
  type CampaignFormValues,
} from "@/server/campaigns/schemas";
import { CHANNEL_LABELS } from "@/server/prospects/profile-url";

type Errors = Record<string, string>;

const CHANNEL_NOTES: Record<CampaignChannel, string> = {
  instagram: "El primer mensaje lo envía el setter desde la cola.",
  facebook: "El primer mensaje lo envía el setter desde la cola.",
  tiktok: "El primer mensaje lo envía el setter desde la cola.",
  whatsapp: "El primer mensaje lo envía el setter desde la cola.",
  email: "Se envía automático con secuencias, con link de baja.",
};

const TONE_PRESETS = [
  "Cercano y profesional, sin vender de entrada.",
  "Directo y breve, de colega a colega.",
  "Formal y consultivo.",
];

function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={id} className="text-destructive text-sm">
      {error}
    </p>
  ) : null;
}

function TextField(props: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  const Comp = props.multiline ? Textarea : Input;
  return (
    <div className="grid gap-2">
      <Label htmlFor={props.id}>{props.label}</Label>
      <Comp
        id={props.id}
        value={props.value}
        placeholder={props.placeholder}
        onChange={(e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) =>
          props.onChange(e.target.value)
        }
        aria-invalid={props.error ? true : undefined}
        aria-describedby={props.error ? `${props.id}-error` : undefined}
      />
      {props.hint && !props.error ? (
        <p className="text-muted-foreground text-xs">{props.hint}</p>
      ) : null}
      <FieldError id={`${props.id}-error`} error={props.error} />
    </div>
  );
}

/** Editor de lista de textos (referentes, preguntas). */
function ListEditor(props: {
  idPrefix: string;
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  addLabel: string;
  placeholder: string;
  errors: Errors;
  errorKey: string;
  max: number;
}) {
  const items = props.items.length ? props.items : [""];
  const set = (i: number, v: string) => props.onChange(items.map((x, j) => (j === i ? v : x)));
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">{props.label}</legend>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input
            id={`${props.idPrefix}-${i}`}
            aria-label={`${props.label} ${i + 1}`}
            value={item}
            placeholder={props.placeholder}
            onChange={(e) => set(i, e.target.value)}
            aria-invalid={props.errors[`${props.errorKey}.${i}`] ? true : undefined}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Quitar ${props.label.toLowerCase()} ${i + 1}`}
            onClick={() => props.onChange(items.filter((_, j) => j !== i))}
            disabled={items.length === 1 && !item}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      ))}
      <FieldError id={`${props.errorKey}-error`} error={props.errors[props.errorKey]} />
      {items.length < props.max ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-fit"
          onClick={() => props.onChange([...items, ""])}
        >
          <Plus aria-hidden /> {props.addLabel}
        </Button>
      ) : null}
    </fieldset>
  );
}

export function CampaignWizard({
  initial,
  campaignId,
}: {
  initial: CampaignFormValues;
  campaignId?: string;
}) {
  const [values, setValues] = useState<CampaignFormValues>(initial);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();
  const current = WIZARD_STEPS[step]!;
  const isLast = step === WIZARD_STEPS.length - 1;
  const editing = !!campaignId;

  const update = (patch: Partial<CampaignFormValues>) => setValues((v) => ({ ...v, ...patch }));

  function validateStep(index: number): boolean {
    const result = WIZARD_STEPS[index]!.schema.safeParse(values);
    setErrors(result.success ? {} : issuesByPath(result.error));
    return result.success;
  }

  function goTo(index: number) {
    // Hacia atrás siempre se puede; hacia adelante, validando los pasos intermedios.
    for (let i = step; i < index; i++) {
      if (!validateStep(i)) {
        setStep(i);
        return;
      }
    }
    setErrors({});
    setStep(index);
  }

  function submit(activate: boolean) {
    for (let i = 0; i < WIZARD_STEPS.length; i++) {
      if (!validateStep(i)) {
        setStep(i);
        return;
      }
    }
    setFormError(null);
    startTransition(async () => {
      const result = await saveCampaignAction({ campaignId, values, activate });
      if (result.status === "error") {
        setFormError(result.message ?? "No pudimos guardar la campaña.");
        if (result.fieldErrors) setErrors(result.fieldErrors as Errors);
      }
    });
  }

  const criteria = values.qualificationCriteria ?? [];
  const channels = (values.channels ?? []) as CampaignChannel[];
  const limits = (values.dailyLimits ?? {}) as Partial<Record<CampaignChannel, number | string>>;

  return (
    <div className="grid gap-4">
      <nav aria-label="Pasos de la campaña">
        <div className="mb-2 flex items-center gap-2 md:hidden">
          <label htmlFor="wizard-step" className="text-muted-foreground shrink-0 text-sm">
            Paso {step + 1} de {WIZARD_STEPS.length}
          </label>
          {/* En el celular los pasos no entran en una fila: un select permite saltar al editar. */}
          <NativeSelect
            id="wizard-step"
            value={step}
            onChange={(e) => goTo(Number(e.target.value))}
            className="h-9"
          >
            {WIZARD_STEPS.map((s, i) => (
              <option key={s.key} value={i}>
                {s.title}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="bg-muted h-1.5 overflow-hidden rounded-full md:hidden">
          <div
            className="bg-primary h-full transition-all"
            style={{ width: `${((step + 1) / WIZARD_STEPS.length) * 100}%` }}
          />
        </div>
        <ol className="hidden flex-wrap gap-2 md:flex">
          {WIZARD_STEPS.map((s, i) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors",
                  i === step
                    ? "border-primary bg-primary text-primary-foreground"
                    : i < step
                      ? "bg-muted"
                      : "text-muted-foreground",
                )}
              >
                {i + 1}. {s.title}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{current.title}</CardTitle>
          <CardDescription>
            {
              {
                niche: "¿A quién le vas a escribir? Poné un nombre interno y describí el nicho.",
                references:
                  "Referentes del nicho (cuentas, podcasts, autores). La IA los usa para entender el lenguaje y los dolores del nicho; no se scrapean.",
                offer: "Qué ofrecés y a quién exactamente.",
                qualification:
                  "Cómo se decide si un lead califica. La IA hace las preguntas de a una.",
                channels: "Por dónde vas a contactar a los prospectos.",
                tone: "Cómo tienen que sonar los mensajes.",
                limits:
                  "Cuántos mensajes por día puede enviar cada setter en cada canal. Conviene empezar bajo.",
              }[current.key]
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          {current.key === "niche" ? (
            <>
              <TextField
                id="name"
                label="Nombre de la campaña"
                value={values.name ?? ""}
                onChange={(name) => update({ name })}
                error={errors.name}
                placeholder="Ej.: Odontólogos CABA — Q4"
              />
              <TextField
                id="niche"
                label="Nicho"
                value={values.niche ?? ""}
                onChange={(niche) => update({ niche })}
                error={errors.niche}
                placeholder="Ej.: Clínicas odontológicas independientes"
                multiline
              />
            </>
          ) : null}

          {current.key === "references" ? (
            <ListEditor
              idPrefix="reference"
              label="Referente"
              items={values.nicheReferences ?? []}
              onChange={(nicheReferences) => update({ nicheReferences })}
              addLabel="Agregar referente"
              placeholder="Ej.: @referente o nombre del podcast"
              errors={errors}
              errorKey="nicheReferences"
              max={15}
            />
          ) : null}

          {current.key === "offer" ? (
            <>
              <TextField
                id="offer"
                label="Oferta"
                value={values.offer ?? ""}
                onChange={(offer) => update({ offer })}
                error={errors.offer}
                multiline
                placeholder="Qué resultado concreto le das al cliente y cómo."
              />
              <TextField
                id="icp"
                label="Cliente ideal (ICP)"
                value={values.icp ?? ""}
                onChange={(icp) => update({ icp })}
                error={errors.icp}
                multiline
                placeholder="Tamaño, zona, situación, señales de que te necesita."
              />
            </>
          ) : null}

          {current.key === "qualification" ? (
            <>
              <fieldset className="grid gap-3">
                <legend className="mb-2 text-sm font-medium">Criterios de calificación</legend>
                {criteria.map((c, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-[1fr_6rem_auto] sm:items-start">
                    <div className="grid gap-1">
                      <Input
                        aria-label={`Criterio ${i + 1}`}
                        value={c.label}
                        placeholder="Ej.: Tiene presupuesto para marketing"
                        onChange={(e) =>
                          update({
                            qualificationCriteria: criteria.map((x, j) =>
                              j === i ? { ...x, label: e.target.value } : x,
                            ),
                          })
                        }
                        aria-invalid={errors[`qualificationCriteria.${i}.label`] ? true : undefined}
                      />
                      <FieldError
                        id={`criterion-${i}-label-error`}
                        error={errors[`qualificationCriteria.${i}.label`]}
                      />
                    </div>
                    <div className="grid gap-1">
                      <span className="text-muted-foreground text-xs sm:hidden" aria-hidden>
                        Peso (1 a 100)
                      </span>
                      <Input
                        aria-label={`Peso del criterio ${i + 1}`}
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={100}
                        value={String(c.weight ?? "")}
                        onChange={(e) =>
                          update({
                            qualificationCriteria: criteria.map((x, j) =>
                              j === i ? { ...x, weight: e.target.value } : x,
                            ),
                          })
                        }
                        aria-invalid={
                          errors[`qualificationCriteria.${i}.weight`] ? true : undefined
                        }
                      />
                      <FieldError
                        id={`criterion-${i}-weight-error`}
                        error={errors[`qualificationCriteria.${i}.weight`]}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Quitar criterio ${i + 1}`}
                      onClick={() =>
                        update({ qualificationCriteria: criteria.filter((_, j) => j !== i) })
                      }
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                ))}
                <p className="text-muted-foreground text-xs">
                  El peso (1 a 100) indica cuánto suma cada criterio al puntaje del lead.
                </p>
                <FieldError id="criteria-error" error={errors.qualificationCriteria} />
                {criteria.length < 10 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    onClick={() =>
                      update({ qualificationCriteria: [...criteria, { label: "", weight: 50 }] })
                    }
                  >
                    <Plus aria-hidden /> Agregar criterio
                  </Button>
                ) : null}
              </fieldset>
              <ListEditor
                idPrefix="question"
                label="Pregunta"
                items={values.qualificationQuestions ?? []}
                onChange={(qualificationQuestions) => update({ qualificationQuestions })}
                addLabel="Agregar pregunta"
                placeholder="Ej.: ¿Cuántos pacientes nuevos reciben por mes?"
                errors={errors}
                errorKey="qualificationQuestions"
                max={10}
              />
            </>
          ) : null}

          {current.key === "channels" ? (
            <fieldset className="grid gap-2">
              <legend className="sr-only">Canales</legend>
              {CHANNELS.map((ch) => {
                const checked = channels.includes(ch);
                return (
                  <label
                    key={ch}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-3",
                      checked && "border-primary bg-muted/50",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="accent-primary mt-0.5 size-4"
                      checked={checked}
                      onChange={(e) =>
                        update({
                          channels: e.target.checked
                            ? [...channels, ch]
                            : channels.filter((c) => c !== ch),
                        })
                      }
                    />
                    <span className="grid gap-0.5">
                      <span className="text-sm font-medium">{CHANNEL_LABELS[ch]}</span>
                      <span className="text-muted-foreground text-xs">{CHANNEL_NOTES[ch]}</span>
                    </span>
                  </label>
                );
              })}
              <FieldError id="channels-error" error={errors.channels} />
            </fieldset>
          ) : null}

          {current.key === "tone" ? (
            <>
              <TextField
                id="tone"
                label="Tono de los mensajes"
                value={values.tone ?? ""}
                onChange={(tone) => update({ tone })}
                error={errors.tone}
                multiline
              />
              <div className="flex flex-wrap gap-2">
                {TONE_PRESETS.map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => update({ tone: t })}
                  >
                    {t}
                  </Button>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">
                Sea cual sea el tono, si alguien pregunta si habla con un bot, la IA dice la verdad
                y ofrece pasar con una persona.
              </p>
            </>
          ) : null}

          {current.key === "limits" ? (
            channels.length === 0 ? (
              <Alert>Primero elegí al menos un canal.</Alert>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {channels.map((ch) => (
                  <div key={ch} className="grid gap-2">
                    <Label htmlFor={`limit-${ch}`}>
                      {CHANNEL_LABELS[ch]} (por setter, por día)
                    </Label>
                    <Input
                      id={`limit-${ch}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={MAX_DAILY_LIMIT}
                      value={String(limits[ch] ?? DEFAULT_DAILY_LIMITS[ch])}
                      onChange={(e) =>
                        update({ dailyLimits: { ...limits, [ch]: e.target.value } as never })
                      }
                      aria-invalid={errors[`dailyLimits.${ch}`] ? true : undefined}
                    />
                    <FieldError id={`limit-${ch}-error`} error={errors[`dailyLimits.${ch}`]} />
                  </div>
                ))}
              </div>
            )
          ) : null}
        </CardContent>
      </Card>

      {formError ? <Alert variant="destructive">{formError}</Alert> : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={() => goTo(step - 1)}
          disabled={step === 0 || pending}
        >
          <ArrowLeft aria-hidden /> Anterior
        </Button>
        {isLast ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            {editing ? (
              <Button type="button" onClick={() => submit(false)} disabled={!hydrated || pending}>
                {pending ? "Guardando…" : "Guardar cambios"}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => submit(false)}
                  disabled={!hydrated || pending}
                >
                  Guardar como borrador
                </Button>
                <Button type="button" onClick={() => submit(true)} disabled={!hydrated || pending}>
                  {pending ? "Guardando…" : "Guardar y activar"}
                </Button>
              </>
            )}
          </div>
        ) : (
          <Button type="button" onClick={() => goTo(step + 1)} disabled={!hydrated}>
            Siguiente <ArrowRight aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
