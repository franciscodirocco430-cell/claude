/** Resumen de inscripciones de una secuencia. */
export function StatsLine({ stats }: { stats: Record<string, number> }) {
  const items = [
    ["En curso", stats.active],
    ["Terminadas", stats.completed],
    ["Respondieron", stats.stopped_replied],
    ["Rebotaron", stats.stopped_bounced],
    ["Bajas", stats.stopped_unsubscribed],
    ["Frenadas", stats.stopped_manual],
  ] as const;
  return (
    <dl className="grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
      {items.map(([label, n]) => (
        <div key={label} className="rounded-lg border p-2">
          <dt className="text-muted-foreground text-[11px]">{label}</dt>
          <dd className="text-lg font-semibold tabular-nums">{n ?? 0}</dd>
        </div>
      ))}
    </dl>
  );
}
