import { describe, expect, it, vi } from "vitest";
import { busyInterval, calendarEventId, GoogleCalendarProvider } from "./google-calendar";
import { findFreeSlots, formatSlot } from "./slots";

const TZ = "America/Argentina/Buenos_Aires";
const rules = {
  timeZone: TZ,
  durationMinutes: 30,
  startHour: 10,
  endHour: 12,
  days: [1, 2, 3, 4, 5],
  minNoticeHours: 2,
  windowDays: 7,
};

describe("horarios libres", () => {
  // Martes 14/10/2026 09:00 en Buenos Aires (UTC-3).
  const now = new Date("2026-10-14T12:00:00Z");

  it("respeta horario, anticipación mínima y días hábiles; reparte en días distintos", () => {
    const slots = findFreeSlots(rules, [], now, 3);
    // Hoy: 10:00 está a 1 h (anticipación 2 h) → primer horario hoy 11:00.
    expect(slots.map((s) => s.start)).toEqual([
      "2026-10-14T14:00:00.000Z",
      "2026-10-15T13:00:00.000Z",
      "2026-10-16T13:00:00.000Z",
    ]);
    expect(slots.map((s) => s.id)).toEqual(["h1", "h2", "h3"]);
  });

  it("saltea fin de semana y horarios ocupados", () => {
    const friday = new Date("2026-10-16T12:00:00Z");
    const busy = [
      { start: new Date("2026-10-16T13:00:00Z"), end: new Date("2026-10-16T15:00:00Z") },
    ];
    const slots = findFreeSlots(rules, busy, friday, 2);
    // Viernes lleno, sábado y domingo no → lunes 19/10 y martes 20/10 a las 10:00.
    expect(slots.map((s) => s.start)).toEqual([
      "2026-10-19T13:00:00.000Z",
      "2026-10-20T13:00:00.000Z",
    ]);
  });

  it("formatea en la zona horaria", () => {
    expect(formatSlot({ start: "2026-10-14T14:00:00.000Z" }, TZ)).toMatch(
      /miércoles 14\/10 a las 11:00/,
    );
  });
});

describe("Google Calendar", () => {
  it("convierte eventos en ocupados ignorando libres, cancelados y rechazados", () => {
    const ev = (over: object) => ({
      start: { dateTime: "2026-10-14T13:00:00Z" },
      end: { dateTime: "2026-10-14T14:00:00Z" },
      ...over,
    });
    expect(busyInterval(ev({}), TZ)).not.toBeNull();
    expect(busyInterval(ev({ transparency: "transparent" }), TZ)).toBeNull();
    expect(busyInterval(ev({ status: "cancelled" }), TZ)).toBeNull();
    expect(
      busyInterval(ev({ attendees: [{ self: true, responseStatus: "declined" }] }), TZ),
    ).toBeNull();
    const allDay = busyInterval({ start: { date: "2026-10-14" }, end: { date: "2026-10-15" } }, TZ);
    expect(allDay?.start.toISOString()).toBe("2026-10-14T03:00:00.000Z");
  });

  it("ids de evento válidos (base32hex) y deterministas", () => {
    const id = calendarEventId("conv:2026-10-14T14:00:00.000Z");
    expect(id).toMatch(/^[0-9a-v]{5,1024}$/);
    expect(calendarEventId("conv:2026-10-14T14:00:00.000Z")).toBe(id);
  });

  it("crea el evento y, si ya existía (409), devuelve el mismo", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 409 }))
      .mockResolvedValueOnce(Response.json({ id: "abc", htmlLink: "https://cal/abc" }));
    const provider = new GoogleCalendarProvider(
      "https://cal.example/v3",
      async () => "tok",
      fetchMock,
    );
    const out = await provider.createEvent("acc", {
      eventId: "abc",
      summary: "Llamada",
      description: "",
      start: new Date("2026-10-14T14:00:00Z"),
      end: new Date("2026-10-14T14:30:00Z"),
      timeZone: TZ,
      attendeeEmail: null,
    });
    expect(out).toEqual({ id: "abc", htmlLink: "https://cal/abc" });
    expect(fetchMock.mock.calls[0]![0]).toBe("https://cal.example/v3/calendars/primary/events");
    expect(fetchMock.mock.calls[1]![0]).toBe("https://cal.example/v3/calendars/primary/events/abc");
  });

  it("lista eventos paginando y clasifica errores", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          timeZone: TZ,
          nextPageToken: "p2",
          items: [
            {
              start: { dateTime: "2026-10-14T13:00:00Z" },
              end: { dateTime: "2026-10-14T14:00:00Z" },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(Response.json({ items: [] }))
      .mockResolvedValueOnce(new Response("{}", { status: 503 }));
    const provider = new GoogleCalendarProvider(
      "https://cal.example/v3",
      async () => "tok",
      fetchMock,
    );
    const busy = await provider.listBusy("acc", new Date(), new Date(Date.now() + 1e9));
    expect(busy).toHaveLength(1);
    expect(String(fetchMock.mock.calls[1]![0])).toContain("pageToken=p2");
    await expect(provider.listBusy("acc", new Date(), new Date())).rejects.toMatchObject({
      retryable: true,
    });
  });
});
