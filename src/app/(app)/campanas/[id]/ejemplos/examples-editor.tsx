"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated } from "@/hooks/use-hydrated";
import { CHANNEL_RULES } from "@/server/ai/channel-rules";
import { MAX_EXAMPLES_PER_CHANNEL, type CampaignChannel } from "@/server/campaigns/schemas";
import { saveExamplesAction } from "../../actions";

interface Example {
  channel: CampaignChannel;
  context: string;
  message: string;
}

export function ExamplesEditor(props: {
  campaignId: string;
  channels: CampaignChannel[];
  initial: Example[];
}) {
  const [examples, setExamples] = useState<Example[]>(props.initial);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    errors?: Record<string, string>;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();
  const router = useRouter();

  const update = (index: number, patch: Partial<Example>) =>
    setExamples((list) => list.map((e, i) => (i === index ? { ...e, ...patch } : e)));

  return (
    <div className="grid gap-4">
      {props.channels.map((channel) => {
        const rule = CHANNEL_RULES[channel];
        const items = examples.map((e, i) => ({ e, i })).filter(({ e }) => e.channel === channel);
        return (
          <Card key={channel} className="gap-4">
            <CardHeader>
              <CardTitle as="h2">{rule.label}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {items.length === 0 ? (
                <p className="text-muted-foreground text-sm">Sin ejemplos para este canal.</p>
              ) : null}
              {items.map(({ e, i }, n) => (
                <div key={i} className="grid gap-2 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={`Contexto del ejemplo ${n + 1} de ${rule.label}`}
                      placeholder="Contexto (opcional), ej.: clínica con sede nueva"
                      value={e.context}
                      onChange={(ev) => update(i, { context: ev.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Quitar ejemplo ${n + 1} de ${rule.label}`}
                      onClick={() => setExamples((list) => list.filter((_, j) => j !== i))}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                  <Textarea
                    aria-label={`Mensaje del ejemplo ${n + 1} de ${rule.label}`}
                    placeholder="Un mensaje real que haya funcionado bien."
                    value={e.message}
                    onChange={(ev) => update(i, { message: ev.target.value })}
                    aria-invalid={result?.errors?.[`${i}.message`] ? true : undefined}
                  />
                  <p className="text-muted-foreground text-xs">
                    {e.message.length}/{rule.maxChars} caracteres
                  </p>
                  {result?.errors?.[`${i}.message`] ? (
                    <p className="text-destructive text-sm">{result.errors[`${i}.message`]}</p>
                  ) : null}
                </div>
              ))}
              {items.length < MAX_EXAMPLES_PER_CHANNEL ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-fit"
                  onClick={() =>
                    setExamples((list) => [...list, { channel, context: "", message: "" }])
                  }
                >
                  <Plus aria-hidden /> Agregar ejemplo
                </Button>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
      {result ? (
        <Alert variant={result.ok ? "success" : "destructive"}>{result.message}</Alert>
      ) : null}
      <Button
        className="w-full sm:w-fit"
        disabled={!hydrated || pending}
        onClick={() =>
          startTransition(async () => {
            const res = await saveExamplesAction({ campaignId: props.campaignId, examples });
            setResult({
              ok: res.status === "success",
              message: (res.status !== "idle" && res.message) || "",
              errors:
                res.status === "error" ? (res.fieldErrors as Record<string, string>) : undefined,
            });
            if (res.status === "success") router.refresh();
          })
        }
      >
        {pending ? "Guardando…" : "Guardar ejemplos"}
      </Button>
    </div>
  );
}
