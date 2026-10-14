import { z } from "zod";
import { zonedTime } from "@/server/calendar/slots";

const DAY_MS = 86_400_000;
export const DEFAULT_PERIOD_DAYS = 30;
export const MAX_PERIOD_DAYS = 366;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Fecha local (YYYY-MM-DD) de un instante en la zona dada. */
export function localDate(at: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

function startOf(date: string, timeZone: string) {
  const [y, m, d] = date.split("-").map(Number);
  return zonedTime(y!, m!, d!, 0, timeZone);
}

export interface Period {
  /** Fechas locales, incluidas ambas. */
  desde: string;
  hasta: string;
  from: Date;
  /** Exclusivo: inicio del día siguiente a `hasta`. */
  to: Date;
}

/**
 * Período de las métricas en la zona de la organización. Por defecto los
 * últimos 30 días (incluido hoy). Fechas inválidas o invertidas → defecto;
 * se limita a un año para que la consulta no explote.
 */
export function parsePeriod(
  input: { desde?: string; hasta?: string },
  timeZone: string,
  now = new Date(),
): Period {
  const today = localDate(now, timeZone);
  const hasta = isoDate.safeParse(input.hasta).success ? input.hasta! : today;
  const defaultFrom = localDate(
    new Date(startOf(hasta, timeZone).getTime() - (DEFAULT_PERIOD_DAYS - 1) * DAY_MS + DAY_MS / 2),
    timeZone,
  );
  let desde = isoDate.safeParse(input.desde).success ? input.desde! : defaultFrom;
  if (desde > hasta) desde = defaultFrom;
  const from = startOf(desde, timeZone);
  const [y, m, d] = hasta.split("-").map(Number);
  const to = zonedTime(y!, m!, d! + 1, 0, timeZone);
  if (to.getTime() - from.getTime() > MAX_PERIOD_DAYS * DAY_MS) {
    const limited = localDate(
      new Date(to.getTime() - MAX_PERIOD_DAYS * DAY_MS + DAY_MS / 2),
      timeZone,
    );
    return { desde: limited, hasta, from: startOf(limited, timeZone), to };
  }
  return { desde, hasta, from, to };
}
