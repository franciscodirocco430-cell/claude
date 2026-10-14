import { z } from "zod";
import { zonedTime, type Interval } from "./slots";

export interface CalendarEventInput {
  /** Id determinista (base32hex): reintentar no duplica el evento. */
  eventId: string;
  summary: string;
  description: string;
  start: Date;
  end: Date;
  timeZone: string;
  attendeeEmail: string | null;
}

export class CalendarError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "CalendarError";
  }
}

export interface CalendarProvider {
  listBusy(accountId: string, from: Date, to: Date): Promise<Interval[]>;
  createEvent(
    accountId: string,
    input: CalendarEventInput,
  ): Promise<{ id: string; htmlLink: string | null }>;
}

const eventSchema = z.object({
  id: z.string().optional(),
  status: z.string().optional(),
  transparency: z.string().optional(),
  start: z.object({ dateTime: z.string().optional(), date: z.string().optional() }).optional(),
  end: z.object({ dateTime: z.string().optional(), date: z.string().optional() }).optional(),
  attendees: z
    .array(z.object({ self: z.boolean().optional(), responseStatus: z.string().optional() }))
    .optional(),
});

const listSchema = z.object({
  timeZone: z.string().optional(),
  nextPageToken: z.string().optional(),
  items: z.array(z.unknown()).default([]),
});

/** Convierte un evento de Google en intervalo ocupado (null si no ocupa tiempo). */
export function busyInterval(raw: unknown, calendarTimeZone: string): Interval | null {
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) return null;
  const e = parsed.data;
  if (e.status === "cancelled" || e.transparency === "transparent") return null;
  if (e.attendees?.some((a) => a.self && a.responseStatus === "declined")) return null;
  const at = (p: { dateTime?: string; date?: string } | undefined) => {
    if (p?.dateTime) return new Date(p.dateTime);
    if (p?.date) {
      const [y, m, d] = p.date.split("-").map(Number);
      return zonedTime(y!, m!, d!, 0, calendarTimeZone);
    }
    return null;
  };
  const start = at(e.start);
  const end = at(e.end);
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return end > start ? { start, end } : null;
}

/** Id de evento válido para Google (base32hex en minúsculas: 0-9 y a-v). */
export function calendarEventId(seed: string) {
  const hex = Buffer.from(seed).toString("hex");
  return `sc${hex}`.replace(/[^0-9a-v]/g, "0").slice(0, 120);
}

/**
 * Google Calendar con el scope `calendar.events`: los ocupados salen de listar
 * eventos (no se usa freeBusy) y la reunión se crea en el calendario principal.
 */
export class GoogleCalendarProvider implements CalendarProvider {
  constructor(
    private readonly apiUrl: string,
    private readonly getAccessToken: (accountId: string) => Promise<string>,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async call(accountId: string, path: string, init: RequestInit = {}) {
    const token = await this.getAccessToken(accountId);
    const res = await this.fetchImpl(`${this.apiUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
    return res;
  }

  private fail(res: Response, what: string): never {
    const retryable = res.status === 429 || res.status >= 500;
    throw new CalendarError(`Google Calendar respondió ${res.status} al ${what}.`, retryable);
  }

  async listBusy(accountId: string, from: Date, to: Date) {
    const busy: Interval[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 5; page++) {
      const qs = new URLSearchParams({
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "250",
        ...(pageToken ? { pageToken } : {}),
      });
      const res = await this.call(accountId, `/calendars/primary/events?${qs}`);
      if (!res.ok) this.fail(res, "listar eventos");
      const data = listSchema.parse(await res.json());
      for (const item of data.items) {
        const interval = busyInterval(item, data.timeZone ?? "UTC");
        if (interval) busy.push(interval);
      }
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
    return busy;
  }

  async createEvent(accountId: string, input: CalendarEventInput) {
    const body = {
      id: input.eventId,
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.start.toISOString(), timeZone: input.timeZone },
      end: { dateTime: input.end.toISOString(), timeZone: input.timeZone },
      ...(input.attendeeEmail ? { attendees: [{ email: input.attendeeEmail }] } : {}),
    };
    const qs = input.attendeeEmail ? "?sendUpdates=all" : "";
    const res = await this.call(accountId, `/calendars/primary/events${qs}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (res.status === 409) {
      // Ya existe (reintento del job): se devuelve el mismo evento.
      const existing = await this.call(
        accountId,
        `/calendars/primary/events/${encodeURIComponent(input.eventId)}`,
      );
      if (!existing.ok) this.fail(existing, "leer el evento");
      const e = (await existing.json()) as { id?: string; htmlLink?: string };
      return { id: e.id ?? input.eventId, htmlLink: e.htmlLink ?? null };
    }
    if (!res.ok) this.fail(res, "crear el evento");
    const e = (await res.json()) as { id?: string; htmlLink?: string };
    return { id: e.id ?? input.eventId, htmlLink: e.htmlLink ?? null };
  }
}

/** Calendario en memoria para tests. */
export class FakeCalendarProvider implements CalendarProvider {
  readonly events: (CalendarEventInput & { accountId: string })[] = [];
  constructor(public busy: Interval[] = []) {}

  async listBusy() {
    return [...this.busy, ...this.events.map((e) => ({ start: e.start, end: e.end }))];
  }

  async createEvent(accountId: string, input: CalendarEventInput) {
    if (!this.events.some((e) => e.eventId === input.eventId)) {
      this.events.push({ ...input, accountId });
    }
    return { id: input.eventId, htmlLink: `https://calendar.example/${input.eventId}` };
  }
}
