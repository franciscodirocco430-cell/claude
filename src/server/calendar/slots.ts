import type { Slot } from "@/server/agent/settings";

export interface Interval {
  start: Date;
  end: Date;
}

export interface SlotRules {
  timeZone: string;
  durationMinutes: number;
  startHour: number;
  endHour: number;
  days: number[];
  minNoticeHours: number;
  windowDays: number;
}

const MINUTE = 60_000;

/** Partes de fecha/hora de un instante en una zona horaria. */
function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday,
  };
}

/** Instante UTC de una hora local (año, mes, día, hora) en la zona dada. */
export function zonedTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
) {
  const guess = Date.UTC(year, month - 1, day, hour);
  // Ajuste por el offset de la zona en ese momento (dos pasadas cubren los cambios de horario).
  let ts = guess;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(ts), timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    ts += guess - asUtc;
  }
  return new Date(ts);
}

const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/**
 * Horarios libres para ofrecer: dentro del horario y días configurados, con
 * anticipación mínima, sin pisar eventos ocupados. Devuelve como mucho `count`,
 * repartidos en días distintos cuando se puede (es más fácil elegir).
 */
export function findFreeSlots(rules: SlotRules, busy: Interval[], now: Date, count = 3): Slot[] {
  const step = rules.durationMinutes * MINUTE;
  const earliest = new Date(now.getTime() + rules.minNoticeHours * 60 * MINUTE);
  const byDay: Interval[][] = [];
  const today = zonedParts(now, rules.timeZone);
  for (let d = 0; d <= rules.windowDays; d++) {
    // Mediodía local del día d: evita saltos de fecha por el offset.
    const noon = zonedTime(today.year, today.month, today.day + d, 12, rules.timeZone);
    const p = zonedParts(noon, rules.timeZone);
    if (!rules.days.includes(p.weekday)) continue;
    const dayStart = zonedTime(p.year, p.month, p.day, rules.startHour, rules.timeZone);
    const dayEnd = zonedTime(p.year, p.month, p.day, rules.endHour, rules.timeZone);
    const free: Interval[] = [];
    for (let t = dayStart.getTime(); t + step <= dayEnd.getTime(); t += step) {
      const slot = { start: new Date(t), end: new Date(t + step) };
      if (slot.start < earliest) continue;
      if (busy.some((b) => overlaps(slot, b))) continue;
      free.push(slot);
    }
    if (free.length) byDay.push(free);
  }
  // Primero uno por día (el más temprano); si faltan, se completa con más del mismo día.
  const picked: Interval[] = [];
  for (const day of byDay) if (picked.length < count) picked.push(day[0]!);
  for (const day of byDay) {
    for (const slot of day.slice(1)) if (picked.length < count) picked.push(slot);
  }
  return picked
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map((s, i) => ({ id: `h${i + 1}`, start: s.start.toISOString(), end: s.end.toISOString() }));
}

/** "martes 21/10 a las 10:00" en la zona del prospecto (formato estable, sin depender de ICU). */
export function formatSlot(slot: Pick<Slot, "start">, timeZone: string) {
  const p = zonedParts(new Date(slot.start), timeZone);
  const days = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const two = (n: number) => String(n).padStart(2, "0");
  return `${days[p.weekday]} ${two(p.day)}/${two(p.month)} a las ${two(p.hour)}:${two(p.minute)}`;
}
