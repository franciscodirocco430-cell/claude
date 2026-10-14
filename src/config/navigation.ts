import {
  BarChart3,
  Inbox,
  KanbanSquare,
  ListTodo,
  Megaphone,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  /** Etiqueta corta para la barra inferior en el celular. */
  shortLabel: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/campanas", label: "Campañas", shortLabel: "Campañas", icon: Megaphone },
  { href: "/cola", label: "Cola", shortLabel: "Cola", icon: ListTodo },
  { href: "/bandeja", label: "Bandeja", shortLabel: "Bandeja", icon: Inbox },
  { href: "/crm", label: "CRM", shortLabel: "CRM", icon: KanbanSquare },
  { href: "/metricas", label: "Métricas", shortLabel: "Métricas", icon: BarChart3 },
  { href: "/configuracion", label: "Configuración", shortLabel: "Ajustes", icon: Settings },
];

/** Un ítem está activo si la ruta es la suya o una subruta (ej. /campanas/123). */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
