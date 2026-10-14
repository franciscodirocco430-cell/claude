/**
 * Horario hábil del prospecto: por defecto lunes a viernes de 9 a 18 en su zona
 * horaria (o la de la organización). Las fechas se calculan en UTC.
 */
export interface BusinessHours {
  startHour: number;
  endHour: number;
  /** 0 = domingo … 6 = sábado. */
  days: number[];
}

export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  startHour: 9,
  endHour: 18,
  days: [1, 2, 3, 4, 5],
};

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function localParts(date: Date, timeZone: string): LocalParts {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    weekday: WEEKDAYS[p.weekday as string] ?? 0,
  };
}

/** Instante UTC de una hora local dada (resuelve el offset de esa fecha). */
function zonedTime(year: number, month: number, day: number, hour: number, timeZone: string): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour));
  const p = localParts(guess, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return new Date(guess.getTime() - (asUtc - guess.getTime()));
}

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Primer momento >= `from` dentro del horario hábil. Si cae fuera, devuelve la
 * próxima apertura más un jitter aleatorio (para que no salgan todos a las 9:00).
 */
export function nextSendSlot(
  from: Date,
  timeZone: string,
  hours: BusinessHours = DEFAULT_BUSINESS_HOURS,
  jitterMinutes = 0,
): Date {
  const p = localParts(from, timeZone);
  if (hours.days.includes(p.weekday) && p.hour >= hours.startHour && p.hour < hours.endHour)
    return from;

  for (let offset = 0; offset < 8; offset++) {
    const day = new Date(Date.UTC(p.year, p.month - 1, p.day + offset));
    const weekday = day.getUTCDay();
    if (!hours.days.includes(weekday)) continue;
    const open = zonedTime(
      day.getUTCFullYear(),
      day.getUTCMonth() + 1,
      day.getUTCDate(),
      hours.startHour,
      timeZone,
    );
    if (open.getTime() >= from.getTime()) return new Date(open.getTime() + jitterMinutes * 60_000);
  }
  return from;
}
