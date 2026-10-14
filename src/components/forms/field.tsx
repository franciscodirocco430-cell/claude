import type * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Field({
  label,
  name,
  error,
  hint,
  ...props
}: React.ComponentProps<typeof Input> & {
  label: string;
  name: string;
  error?: string;
  hint?: string;
}) {
  const id = props.id ?? `field-${name}`;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-sm">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
