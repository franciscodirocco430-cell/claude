import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import type { InboxFilters } from "@/server/inbox/service";
import { CHANNEL_LABELS } from "@/server/prospects/profile-url";

/**
 * Filtros como formulario GET: funcionan sin JavaScript y la URL se puede
 * compartir o guardar.
 */
export function InboxFiltersForm({
  filters,
  campaigns,
  stages,
  members,
}: {
  filters: InboxFilters;
  campaigns: { id: string; name: string }[];
  stages: { key: string; name: string }[];
  members: { userId: string; name: string }[];
}) {
  const active = Object.entries(filters).some(([k, v]) => k !== "pagina" && v);
  return (
    <details open={active} className="mb-4 rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Filtros{active ? " (activos)" : ""}
      </summary>
      <form method="get" className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="grid gap-1">
          <Label htmlFor="f-canal">Canal</Label>
          <NativeSelect id="f-canal" name="canal" defaultValue={filters.canal ?? ""}>
            <option value="">Todos</option>
            {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="f-campana">Campaña</Label>
          <NativeSelect id="f-campana" name="campana" defaultValue={filters.campana ?? ""}>
            <option value="">Todas</option>
            <option value="sin">Sin campaña</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="f-etapa">Etapa</Label>
          <NativeSelect id="f-etapa" name="etapa" defaultValue={filters.etapa ?? ""}>
            <option value="">Todas</option>
            {stages.map((s) => (
              <option key={s.key} value={s.key}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="f-asignado">Asignada a</Label>
          <NativeSelect id="f-asignado" name="asignado" defaultValue={filters.asignado ?? ""}>
            <option value="">Cualquiera</option>
            <option value="yo">A mí</option>
            <option value="nadie">Sin asignar</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="f-estado">Estado</Label>
          <NativeSelect id="f-estado" name="estado" defaultValue={filters.estado ?? ""}>
            <option value="">Todas</option>
            <option value="pausada">Necesitan una persona (IA pausada)</option>
          </NativeSelect>
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-5">
          <Button type="submit" size="sm">
            Filtrar
          </Button>
          {active ? (
            <Button asChild size="sm" variant="ghost">
              <Link href="/bandeja">Limpiar filtros</Link>
            </Button>
          ) : null}
        </div>
      </form>
    </details>
  );
}
