import { describe, expect, it } from "vitest";
import { htmlToText } from "./html-text";
import { isPathAllowed, parseRobots } from "./robots";
import { isForbiddenSocialHost, isPrivateAddress } from "./url-safety";
import { PublicWebsiteFetcher } from "./website";

describe("robots.txt", () => {
  const robots = `
User-agent: *
Disallow: /privado
Allow: /privado/publico
Disallow: /*.pdf$

User-agent: SetterCopilotBot
Disallow: /solo-para-nosotros
`;
  it("usa el grupo específico si existe", () => {
    const rules = parseRobots(robots, "SetterCopilotBot");
    expect(isPathAllowed(rules, "/solo-para-nosotros/x")).toBe(false);
    expect(isPathAllowed(rules, "/privado")).toBe(true);
  });
  it("si no, usa el grupo *, con Allow más largo y comodines", () => {
    const rules = parseRobots(robots, "OtroBot");
    expect(isPathAllowed(rules, "/privado/x")).toBe(false);
    expect(isPathAllowed(rules, "/privado/publico/x")).toBe(true);
    expect(isPathAllowed(rules, "/docs/a.pdf")).toBe(false);
    expect(isPathAllowed(rules, "/docs/a.pdf?x=1")).toBe(true);
    expect(isPathAllowed(rules, "/")).toBe(true);
  });
  it("Disallow: / bloquea todo", () => {
    expect(isPathAllowed(parseRobots("User-agent: *\nDisallow: /", "x"), "/")).toBe(false);
  });
});

describe("htmlToText", () => {
  it("extrae título, descripción y texto sin scripts ni navegación", () => {
    const page = htmlToText(`<html><head><title>Clínica Dental &amp; Estética</title>
      <meta name="description" content="Implantes en Palermo"><script>alert(1)</script><style>p{}</style></head>
      <body><nav>Menú</nav><h1>Bienvenidos</h1><p>Atendemos de lunes a viernes.</p><footer>©</footer></body></html>`);
    expect(page.title).toBe("Clínica Dental & Estética");
    expect(page.description).toBe("Implantes en Palermo");
    expect(page.text).toBe("Bienvenidos\nAtendemos de lunes a viernes.");
  });
  it("recorta textos largos", () => {
    expect(htmlToText(`<p>${"a".repeat(100)}</p>`, 10).text).toBe(`${"a".repeat(10)}…`);
  });
});

describe("seguridad de URLs", () => {
  it("bloquea dominios de redes sociales y subdominios", () => {
    expect(isForbiddenSocialHost("www.instagram.com")).toBe(true);
    expect(isForbiddenSocialHost("m.facebook.com")).toBe(true);
    expect(isForbiddenSocialHost("tiktok.com")).toBe(true);
    expect(isForbiddenSocialHost("clinica.com.ar")).toBe(false);
    expect(isForbiddenSocialHost("notinstagram.com")).toBe(false);
  });
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "192.168.0.10",
    "172.20.0.1",
    "169.254.169.254",
    "::1",
    "fd00::1",
    "::ffff:10.0.0.1",
    "0.0.0.0",
  ])("%s es interna", (ip) => expect(isPrivateAddress(ip)).toBe(true));
  it.each(["8.8.8.8", "200.45.1.1", "2800:3f0:4002:80b::200e"])("%s es pública", (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  );
});

describe("PublicWebsiteFetcher", () => {
  const publicDns = async () => ["93.184.216.34"];
  const html = (body: string, status = 200, headers: Record<string, string> = {}) =>
    new Response(body, {
      status,
      headers: { "content-type": "text/html; charset=utf-8", ...headers },
    });

  it("lee una página permitida", async () => {
    const fetcher = new PublicWebsiteFetcher(publicDns, (async (u: URL) =>
      u.pathname === "/robots.txt"
        ? new Response("", { status: 404 })
        : html("<head><title>Hola</title></head><p>Texto</p>")) as never);
    const r = await fetcher.fetchPage("https://clinica.example.com/");
    expect(r).toMatchObject({ ok: true, page: { title: "Hola", text: "Texto" } });
  });

  it("respeta robots.txt", async () => {
    const fetcher = new PublicWebsiteFetcher(publicDns, (async (u: URL) =>
      u.pathname === "/robots.txt"
        ? new Response("User-agent: *\nDisallow: /", { status: 200 })
        : html("x")) as never);
    expect(await fetcher.fetchPage("https://clinica.example.com/")).toMatchObject({
      ok: false,
      reason: /robots/,
    });
  });

  it("nunca accede a redes sociales", async () => {
    let called = false;
    const fetcher = new PublicWebsiteFetcher(publicDns, (async () => {
      called = true;
      return html("x");
    }) as never);
    expect(await fetcher.fetchPage("https://www.instagram.com/clinica")).toMatchObject({
      ok: false,
      reason: /red social/,
    });
    expect(called).toBe(false);
  });

  it("rechaza dominios que resuelven a IPs internas, también tras un redirect", async () => {
    const dns = async (host: string) =>
      host === "interno.example.com" ? ["10.0.0.5"] : ["93.184.216.34"];
    const fetcher = new PublicWebsiteFetcher(dns, (async (u: URL) => {
      if (u.pathname === "/robots.txt") return new Response("", { status: 404 });
      return new Response(null, {
        status: 302,
        headers: { location: "https://interno.example.com/" },
      });
    }) as never);
    expect(await fetcher.fetchPage("https://clinica.example.com/")).toMatchObject({
      ok: false,
      reason: /interna/,
    });
  });

  it("rechaza contenido que no es HTML y puertos raros", async () => {
    const fetcher = new PublicWebsiteFetcher(publicDns, (async (u: URL) =>
      u.pathname === "/robots.txt"
        ? new Response("", { status: 404 })
        : new Response("%PDF", { headers: { "content-type": "application/pdf" } })) as never);
    expect(await fetcher.fetchPage("https://clinica.example.com/a")).toMatchObject({
      ok: false,
      reason: /HTML/,
    });
    expect(await fetcher.fetchPage("http://clinica.example.com:6379/")).toMatchObject({
      ok: false,
      reason: /Puerto/,
    });
  });
});
