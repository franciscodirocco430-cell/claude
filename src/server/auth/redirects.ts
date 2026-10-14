/** Rutas que no requieren sesión. */
export const PUBLIC_PATHS = ["/login", "/registro", "/auth", "/invitacion"] as const;

export const LOGIN_PATH = "/login";
export const DEFAULT_AFTER_LOGIN = "/campanas";

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Sanea el parámetro `next` para evitar open redirects: solo rutas internas
 * absolutas ("/algo"), nunca "//dominio", "/\\dominio" ni URLs completas.
 */
export function safeNextPath(
  next: string | null | undefined,
  fallback: string = DEFAULT_AFTER_LOGIN,
): string {
  if (!next || typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  try {
    const url = new URL(next, "http://internal.invalid");
    if (url.origin !== "http://internal.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
