"use client";

import { Download, FileUp } from "lucide-react";
import Link from "next/link";
import Papa from "papaparse";
import { useState, useTransition } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  CSV_FIELD_LABELS,
  CSV_FIELDS,
  CSV_MAX_BYTES,
  CSV_MAX_ROWS,
  CsvError,
  parseCsv,
  suggestMapping,
  validateMapping,
  type ColumnMapping,
  type CsvField,
  type ParsedCsv,
} from "@/server/prospects/csv";
import type { RowStatus } from "@/server/prospects/ingest";
import { importCsvAction, type ImportResult } from "../../actions";

const STATUS_LABELS: Record<RowStatus, string> = {
  created: "Cargado (con avisos)",
  duplicate_in_file: "Repetido en el archivo",
  duplicate_existing: "Ya existía",
  suppressed: "En lista de supresión",
  invalid: "Inválido",
};

type Stage =
  | { name: "pick" }
  | { name: "map"; fileName: string; text: string; csv: ParsedCsv; mapping: ColumnMapping }
  | { name: "done"; fileName: string; csv: ParsedCsv; result: ImportResult };

function downloadIssues(csv: ParsedCsv, result: ImportResult, fileName: string) {
  const rows = result.issues.map((issue) => [
    String(issue.row),
    STATUS_LABELS[issue.status],
    [issue.reason, ...issue.warnings].filter(Boolean).join(" | "),
    ...(csv.rows[issue.row - 2] ?? []),
  ]);
  const content = Papa.unparse({
    fields: ["fila", "estado", "motivo", ...csv.headers],
    data: rows,
  });
  const url = URL.createObjectURL(new Blob([`﻿${content}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `problemas-${fileName}`;
  a.click();
  URL.revokeObjectURL(url);
}

export function CsvImport({ campaignId }: { campaignId: string }) {
  const [stage, setStage] = useState<Stage>({ name: "pick" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hydrated = useHydrated();

  async function onFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (file.size > CSV_MAX_BYTES) {
      setError("El archivo supera los 2 MB.");
      return;
    }
    try {
      const text = await file.text();
      const csv = parseCsv(text);
      setStage({
        name: "map",
        fileName: file.name,
        text,
        csv,
        mapping: suggestMapping(csv.headers),
      });
    } catch (e) {
      setError(e instanceof CsvError ? e.message : "No pudimos leer el archivo. ¿Es un CSV?");
    }
  }

  if (stage.name === "pick") {
    return (
      <Card>
        <CardHeader>
          <CardTitle as="h2">1. Elegí el archivo</CardTitle>
          <CardDescription>
            CSV separado por comas o punto y coma, con encabezados en la primera fila. Hasta{" "}
            {CSV_MAX_ROWS.toLocaleString("es-AR")} filas y 2 MB. Exportalo desde Excel o Google
            Sheets como “CSV”.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <label
            htmlFor="csv-file"
            className="hover:bg-muted/40 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center"
          >
            <FileUp className="text-muted-foreground size-6" aria-hidden />
            <span className="text-sm font-medium">Tocá para elegir un archivo .csv</span>
          </label>
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            disabled={!hydrated}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          {error ? <Alert variant="destructive">{error}</Alert> : null}
        </CardContent>
      </Card>
    );
  }

  if (stage.name === "map") {
    const mappingError = validateMapping(stage.mapping, stage.csv.headers.length);
    const setField = (i: number, field: CsvField | null) =>
      setStage({ ...stage, mapping: stage.mapping.map((m, j) => (j === i ? field : m)) });

    return (
      <Card>
        <CardHeader>
          <CardTitle as="h2">2. Asigná las columnas</CardTitle>
          <CardDescription>
            {stage.fileName} · {stage.csv.rows.length.toLocaleString("es-AR")} filas. Revisá a qué
            dato corresponde cada columna; las que no necesites, dejalas en “No importar”.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ul className="divide-y rounded-lg border">
            {stage.csv.headers.map((header, i) => (
              <li key={i} className="grid gap-2 p-3 sm:grid-cols-[1fr_14rem] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{header || `Columna ${i + 1}`}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {stage.csv.rows
                      .slice(0, 3)
                      .map((r) => r[i])
                      .filter(Boolean)
                      .join(" · ") || "(vacía)"}
                  </p>
                </div>
                <NativeSelect
                  aria-label={`Campo para la columna ${header || i + 1}`}
                  value={stage.mapping[i] ?? ""}
                  onChange={(e) => setField(i, (e.target.value || null) as CsvField | null)}
                >
                  <option value="">No importar</option>
                  {CSV_FIELDS.map((f) => (
                    <option key={f} value={f}>
                      {CSV_FIELD_LABELS[f]}
                    </option>
                  ))}
                </NativeSelect>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs">
            Se descartan los contactos que ya existen en tu organización o que están en la lista de
            supresión. El consentimiento de WhatsApp solo se registra si viene con fecha.
          </p>
          {mappingError ? <Alert>{mappingError}</Alert> : null}
          {error ? <Alert variant="destructive">{error}</Alert> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" onClick={() => setStage({ name: "pick" })} disabled={pending}>
              Elegir otro archivo
            </Button>
            <Button
              disabled={!!mappingError || pending || !hydrated}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const res = await importCsvAction({
                    campaignId,
                    fileName: stage.fileName,
                    csvText: stage.text,
                    mapping: stage.mapping,
                  });
                  if (res.status === "success" && res.data) {
                    setStage({
                      name: "done",
                      fileName: stage.fileName,
                      csv: stage.csv,
                      result: res.data,
                    });
                  } else {
                    setError(
                      (res.status === "error" && res.message) || "No pudimos importar el archivo.",
                    );
                  }
                })
              }
            >
              {pending
                ? "Importando…"
                : `Importar ${stage.csv.rows.length.toLocaleString("es-AR")} filas`}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { report, issues } = stage.result;
  const stats = [
    { label: "Cargados", value: report.created },
    { label: "Ya existían", value: report.duplicatesExisting },
    { label: "Repetidos en el archivo", value: report.duplicatesInFile },
    { label: "En lista de supresión", value: report.suppressed },
    { label: "Inválidos", value: report.invalid },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">3. Resultado</CardTitle>
        <CardDescription>{stage.fileName}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg border p-3">
              <dt className="text-muted-foreground text-xs">{s.label}</dt>
              <dd className="text-2xl font-semibold tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
        {issues.length > 0 ? (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-sm font-medium">Filas con problemas o avisos</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadIssues(stage.csv, stage.result, stage.fileName)}
              >
                <Download aria-hidden /> Descargar CSV
              </Button>
            </div>
            <ul className="max-h-96 divide-y overflow-y-auto rounded-lg border text-sm">
              {issues.map((issue) => (
                <li key={issue.row} className="grid gap-0.5 p-3">
                  <p>
                    <span className="font-medium">Fila {issue.row}</span> ·{" "}
                    {STATUS_LABELS[issue.status]}
                  </p>
                  {[issue.reason, ...issue.warnings].filter(Boolean).map((m, i) => (
                    <p key={i} className="text-muted-foreground">
                      {m}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setStage({ name: "pick" })}>
            Importar otro archivo
          </Button>
          <Button asChild>
            <Link href={`/campanas/${campaignId}`}>Ver prospectos</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
