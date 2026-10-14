export interface BackoffOptions {
  baseMs?: number;
  maxMs?: number;
  /** Fuente de aleatoriedad inyectable para tests. Devuelve [0, 1). */
  random?: () => number;
}

/**
 * Backoff exponencial con "full jitter": espera aleatoria entre 0 y
 * min(max, base * 2^(intento-1)). Evita que todos los reintentos caigan juntos.
 */
export function computeBackoffMs(attempt: number, options: BackoffOptions = {}): number {
  const { baseMs = 5_000, maxMs = 60 * 60 * 1000, random = Math.random } = options;
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.floor(random() * exp);
}
