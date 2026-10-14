import type { FieldErrors } from "@/server/auth/schemas";

/** Estado estándar que devuelven las server actions a los formularios. */
export type ActionState<T = undefined> =
  | { status: "idle" }
  | {
      status: "error";
      message?: string;
      fieldErrors?: FieldErrors;
      values?: Record<string, string>;
    }
  | { status: "success"; message?: string; data?: T };

export const idle: ActionState<never> = { status: "idle" };

/** FormData → objeto plano de strings (los File se ignoran). */
export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$ACTION")) out[key] = value;
  }
  return out;
}
