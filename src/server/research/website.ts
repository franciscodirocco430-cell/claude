import { lookup } from "node:dns/promises";
import { htmlToText, type PageText } from "./html-text";
import { isPathAllowed, parseRobots } from "./robots";
import { isForbiddenSocialHost, isPrivateAddress } from "./url-safety";

export const RESEARCH_USER_AGENT = "SetterCopilotBot/1.0 (+https://settercopilot.example/bot)";
const ROBOTS_TOKEN = "SetterCopilotBot";
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;

export type WebsiteResult =
  { ok: true; url: string; page: PageText } | { ok: false; url: string; reason: string };

export interface WebsiteFetcher {
  fetchPage(url: string): Promise<WebsiteResult>;
}

type Resolver = (host: string) => Promise<string[]>;

const defaultResolver: Resolver = async (host) =>
  (await lookup(host, { all: true, verbatim: true })).map((r) => r.address);

async function assertSafeUrl(url: URL, resolve: Resolver): Promise<string | null> {
  if (url.protocol !== "http:" && url.protocol !== "https:") return "Solo se aceptan URLs http(s).";
  if (url.username || url.password) return "URL con credenciales.";
  if (url.port && !["80", "443"].includes(url.port)) return "Puerto no permitido.";
  if (isForbiddenSocialHost(url.hostname))
    return "Es una red social: no se accede (política del producto).";
  let addresses: string[];
  try {
    addresses = await resolve(url.hostname.replace(/^\[|\]$/g, ""));
  } catch {
    return "No se pudo resolver el dominio.";
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    return "El dominio apunta a una dirección interna.";
  }
  return null;
}

async function readLimited(res: Response, maxBytes: number): Promise<string | null> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}

/**
 * Lee la página pública de un negocio con un fetch simple, respetando robots.txt.
 * Defensas: solo http(s), sin IPs internas (se revalida en cada redirect), sin
 * dominios de redes sociales, timeout, tope de tamaño y solo HTML.
 * Nota: queda una ventana teórica de DNS rebinding entre la validación y la
 * conexión; el riesgo es acotado porque solo se lee HTML y nunca se reenvía.
 */
export class PublicWebsiteFetcher implements WebsiteFetcher {
  constructor(
    private readonly resolve: Resolver = defaultResolver,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async get(url: URL): Promise<Response> {
    return this.fetchImpl(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": RESEARCH_USER_AGENT, accept: "text/html,text/plain;q=0.9" },
    });
  }

  async robotsAllows(url: URL): Promise<boolean> {
    try {
      const res = await this.get(new URL("/robots.txt", url.origin));
      if (res.status >= 400 && res.status < 500) return true; // sin robots.txt: permitido
      if (!res.ok) return false; // 5xx: ante la duda, no
      const text = (await readLimited(res, 500_000)) ?? "";
      return isPathAllowed(parseRobots(text, ROBOTS_TOKEN), url.pathname + url.search);
    } catch {
      return false;
    }
  }

  async fetchPage(input: string): Promise<WebsiteResult> {
    let url: URL;
    try {
      url = new URL(input);
    } catch {
      return { ok: false, url: input, reason: "URL inválida." };
    }

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const unsafe = await assertSafeUrl(url, this.resolve);
      if (unsafe) return { ok: false, url: url.toString(), reason: unsafe };
      if (!(await this.robotsAllows(url))) {
        return {
          ok: false,
          url: url.toString(),
          reason: "robots.txt no permite leer esta página.",
        };
      }

      let res: Response;
      try {
        res = await this.get(url);
      } catch {
        return { ok: false, url: url.toString(), reason: "No respondió a tiempo." };
      }

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return { ok: false, url: url.toString(), reason: "Redirección inválida." };
        url = new URL(location, url);
        continue;
      }
      if (!res.ok) return { ok: false, url: url.toString(), reason: `Respondió ${res.status}.` };
      const type = res.headers.get("content-type") ?? "";
      if (!/text\/html|text\/plain/i.test(type)) {
        return { ok: false, url: url.toString(), reason: "No es una página HTML." };
      }
      const body = await readLimited(res, MAX_BYTES);
      if (body === null)
        return { ok: false, url: url.toString(), reason: "La página es demasiado grande." };
      return { ok: true, url: url.toString(), page: htmlToText(body) };
    }
    return { ok: false, url: url.toString(), reason: "Demasiadas redirecciones." };
  }
}
