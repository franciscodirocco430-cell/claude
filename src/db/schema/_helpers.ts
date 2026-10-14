import { sql, type SQL } from "drizzle-orm";
import { foreignKey, pgPolicy, timestamp, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { authenticatedRole } from "drizzle-orm/supabase";

export const id = () => uuid("id").primaryKey().defaultRandom();

export const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const createdAt = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Quién puede ejecutar una operación sobre filas de su organización. */
export type Access = "member" | "admin" | false;

export interface TenantAccess {
  select: Access;
  insert: Access;
  update: Access;
  delete: Access;
}

/** Lectura y escritura para cualquier miembro; borrar requiere owner/admin. */
export const MEMBER_WRITE: TenantAccess = {
  select: "member",
  insert: "member",
  update: "member",
  delete: "admin",
};

/** Lectura para miembros, escritura solo owner/admin (configuración de la org). */
export const ADMIN_WRITE: TenantAccess = {
  select: "member",
  insert: "admin",
  update: "admin",
  delete: "admin",
};

/** Solo lectura desde el cliente: lo escribe el servidor con privilegios elevados. */
export const READ_ONLY: TenantAccess = {
  select: "member",
  insert: false,
  update: false,
  delete: false,
};

const check = (access: Exclude<Access, false>, orgColumn: AnyPgColumn): SQL =>
  access === "admin"
    ? sql`public.is_org_admin(${orgColumn})`
    : sql`public.is_org_member(${orgColumn})`;

/**
 * Políticas RLS estándar multi-tenant: un usuario solo ve y modifica filas de
 * organizaciones de las que es miembro. Las funciones `is_org_member` /
 * `is_org_admin` se definen en la primera migración (security definer).
 */
export function tenantPolicies(table: string, orgColumn: AnyPgColumn, access: TenantAccess) {
  const policies = [];
  if (access.select) {
    policies.push(
      pgPolicy(`${table}_select`, {
        for: "select",
        to: authenticatedRole,
        using: check(access.select, orgColumn),
      }),
    );
  }
  if (access.insert) {
    policies.push(
      pgPolicy(`${table}_insert`, {
        for: "insert",
        to: authenticatedRole,
        withCheck: check(access.insert, orgColumn),
      }),
    );
  }
  if (access.update) {
    policies.push(
      pgPolicy(`${table}_update`, {
        for: "update",
        to: authenticatedRole,
        using: check(access.update, orgColumn),
        withCheck: check(access.update, orgColumn),
      }),
    );
  }
  if (access.delete) {
    policies.push(
      pgPolicy(`${table}_delete`, {
        for: "delete",
        to: authenticatedRole,
        using: check(access.delete, orgColumn),
      }),
    );
  }
  return policies;
}

/**
 * FK compuesta (organization_id, <col>) → padre(organization_id, id).
 * Garantiza a nivel base de datos que una fila nunca referencie datos de otra
 * organización, aunque el `id` del padre sea válido.
 */
export function tenantFk(
  name: string,
  orgColumn: AnyPgColumn,
  column: AnyPgColumn,
  parent: { organizationId: AnyPgColumn; id: AnyPgColumn },
) {
  return foreignKey({
    name,
    columns: [orgColumn, column],
    foreignColumns: [parent.organizationId, parent.id],
  });
}
