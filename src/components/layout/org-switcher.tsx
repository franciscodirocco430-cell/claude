"use client";

import { switchOrganizationAction } from "@/app/actions/organization";
import { NativeSelect } from "@/components/ui/native-select";

export function OrgSwitcher({
  organizations,
  activeId,
}: {
  organizations: { organizationId: string; name: string }[];
  activeId: string;
}) {
  if (organizations.length < 2) return null;
  return (
    <form action={switchOrganizationAction}>
      <label htmlFor="org-switcher" className="sr-only">
        Organización activa
      </label>
      <NativeSelect
        id="org-switcher"
        name="organizationId"
        defaultValue={activeId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        {organizations.map((o) => (
          <option key={o.organizationId} value={o.organizationId}>
            {o.name}
          </option>
        ))}
      </NativeSelect>
    </form>
  );
}
