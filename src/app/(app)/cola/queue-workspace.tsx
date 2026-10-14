"use client";

import { Check, ExternalLink, RefreshCw, SkipForward } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated } from "@/hooks/use-hydrated";
import type { QueueState } from "@/server/queue/service";
import { buildOpenUrl } from "@/server/queue/open-link";
import { CHANNEL_LABELS } from "@/server/prospects/profile-url";
import { markSentAction, regenerateFromQueueAction, skipTaskAction } from "./actions";

type Task = NonNullable<QueueState["task"]>;

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="bg-muted text-muted-foreground ml-1 hidden rounded border px-1 font-mono text-[10px] md:inline">
      {children}
    </kbd>
  );
}

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

export function QueueWorkspace({ task }: { task: Task }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [message, setMessage] = useState(task.message);
  const [opened, setOpened] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const label = CHANNEL_LABELS[task.channel];
  const over = message.length > task.maxChars;

  const openAndCopy = useCallback(() => {
    // window.open tiene que ir directo en el gesto del usuario (si no, el navegador lo bloquea).
    const url = buildOpenUrl(
      task.channel,
      { phone: task.prospect.phone, handles: task.prospect.handles },
      message,
    );
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    navigator.clipboard
      .writeText(message)
      .then(() => setNotice({ ok: true, text: `Mensaje copiado. Pegalo en ${label} y envialo.` }))
      .catch(() => {
        textareaRef.current?.select();
        setNotice({
          ok: false,
          text: "No pudimos copiar automáticamente: copiá el texto seleccionado.",
        });
      });
    setOpened(true);
  }, [label, message, task.channel, task.prospect.handles, task.prospect.phone]);

  const run = useCallback(
    (action: () => Promise<{ status: string; message?: string }>) =>
      startTransition(async () => {
        const res = await action();
        if (res.status === "success") {
          setNotice(null);
          router.refresh();
        } else {
          setNotice({ ok: false, text: res.message ?? "Algo salió mal." });
        }
      }),
    [router],
  );

  const markSent = useCallback(
    () => run(() => markSentAction({ taskId: task.id, message })),
    [run, task.id, message],
  );
  const skip = useCallback(() => run(() => skipTaskAction({ taskId: task.id })), [run, task.id]);
  const regenerate = useCallback(
    () => run(() => regenerateFromQueueAction({ taskId: task.id })),
    [run, task.id],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (pending || !hydrated) return;
      if (isTyping(e.target)) {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          markSent();
        }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "o") openAndCopy();
      else if (key === "e") markSent();
      else if (key === "s") skip();
      else if (key === "r") regenerate();
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hydrated, markSent, openAndCopy, pending, regenerate, skip]);

  const disabled = !hydrated || pending;
  const handle = task.prospect.handles.find((h) => h.channel === task.channel);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <Card className="gap-4">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{label}</Badge>
            <span className="text-muted-foreground text-xs">{task.campaignName}</span>
          </div>
          <CardTitle as="h2" className="text-xl">
            {task.prospect.name}
          </CardTitle>
          <CardDescription>
            {[
              task.prospect.company,
              handle?.handle ? `@${handle.handle}` : null,
              task.channel === "whatsapp" ? task.prospect.phone : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <label htmlFor="queue-message" className="text-sm font-medium">
            Mensaje (podés editarlo)
          </label>
          <Textarea
            id="queue-message"
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="min-h-36 text-base"
            aria-invalid={over || undefined}
          />
          <p className={over ? "text-destructive text-xs" : "text-muted-foreground text-xs"}>
            {message.length}/{task.maxChars} caracteres{over ? " — es largo para este canal" : ""}
          </p>
          {notice ? (
            <Alert variant={notice.ok ? "success" : "destructive"} role="status">
              {notice.text}
            </Alert>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              size="lg"
              onClick={openAndCopy}
              disabled={disabled || !message.trim()}
              className="sm:col-span-2"
            >
              <ExternalLink aria-hidden /> Abrir y copiar
              <Kbd>O</Kbd>
            </Button>
            <Button
              size="lg"
              variant={opened ? "default" : "outline"}
              onClick={markSent}
              disabled={disabled || !message.trim()}
            >
              <Check aria-hidden /> Enviado
              <Kbd>E</Kbd>
            </Button>
            <Button size="lg" variant="outline" onClick={skip} disabled={disabled}>
              <SkipForward aria-hidden /> Saltear
              <Kbd>S</Kbd>
            </Button>
            <Button
              variant="ghost"
              onClick={regenerate}
              disabled={disabled}
              className="sm:col-span-2"
            >
              <RefreshCw aria-hidden /> Regenerar mensaje
              <Kbd>R</Kbd>
            </Button>
          </div>
          <p className="text-muted-foreground hidden text-xs md:block">
            Atajos: O abrir y copiar · E enviado · S saltear · R regenerar · Ctrl+Enter enviado
            desde el texto.
          </p>
        </CardContent>
      </Card>

      <Card className="h-fit gap-3">
        <CardHeader>
          <CardTitle as="h2" className="text-base">
            Investigación
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {task.research ? (
            <>
              <p>{task.research.summary}</p>
              {task.research.hooks.length ? (
                <div>
                  <h3 className="mb-1 font-medium">Ganchos</h3>
                  <ul className="list-disc space-y-1 pl-5">
                    {task.research.hooks.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {task.research.pains.length ? (
                <div>
                  <h3 className="mb-1 font-medium">Dolores probables</h3>
                  <ul className="list-disc space-y-1 pl-5">
                    {task.research.pains.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground">Sin notas de investigación.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
