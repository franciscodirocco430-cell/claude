/**
 * Emulación MÍNIMA de Supabase Auth (GoTrue) para los tests e2e, en entornos
 * sin Docker. Implementa solo lo que usa la app: signup (autoconfirm), login
 * con contraseña, refresh, /user y logout. Escribe en auth.users como GoTrue.
 *
 * Al arrancar recrea la base e2e (shim + migraciones). NO usar fuera de tests.
 */
import { createHmac, randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import postgres from "postgres";
import { applySupabaseShim } from "../../scripts/db/apply-shim";
import { runMigrations } from "../../scripts/db/migrate";

const PORT = Number(process.env.MOCK_GOTRUE_PORT ?? 54399);
const ADMIN_URL = process.env.TEST_DATABASE_URL;
const DB_NAME = process.env.E2E_DATABASE_NAME ?? "setter_e2e";
const SECRET = "e2e-only-secret";

if (!ADMIN_URL) throw new Error("Falta TEST_DATABASE_URL para los tests e2e.");

interface MockUser {
  id: string;
  email: string;
  password: string;
  metadata: Record<string, unknown>;
}

const users = new Map<string, MockUser>();
const refreshTokens = new Map<string, string>();

function b64url(input: string | Buffer) {
  return Buffer.from(input).toString("base64url");
}

function signJwt(payload: Record<string, unknown>) {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

function verifyJwt(token: string): Record<string, unknown> | null {
  const [head, body, sig] = token.split(".");
  if (!head || !body || !sig) return null;
  const expected = createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  if (expected !== sig) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as Record<string, unknown>;
  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) return null;
  return payload;
}

function userJson(u: MockUser) {
  return {
    id: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    email_confirmed_at: new Date().toISOString(),
    user_metadata: u.metadata,
    app_metadata: { provider: "email", providers: ["email"] },
    identities: [],
    created_at: new Date().toISOString(),
  };
}

function session(u: MockUser) {
  const now = Math.floor(Date.now() / 1000);
  const refresh = randomUUID();
  refreshTokens.set(refresh, u.id);
  return {
    access_token: signJwt({
      sub: u.id,
      email: u.email,
      role: "authenticated",
      aud: "authenticated",
      exp: now + 3600,
      iat: now,
      session_id: randomUUID(),
    }),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: refresh,
    user: userJson(u),
  };
}

async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString();
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

function send(res: ServerResponse, status: number, body?: unknown) {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
  });
  res.end(body === undefined ? "" : JSON.stringify(body));
}

const fail = (res: ServerResponse, status: number, code: string, msg: string) =>
  send(res, status, { code: status, error_code: code, msg });

async function main() {
  const admin = postgres(ADMIN_URL!, { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists ${DB_NAME} with (force)`);
  await admin.unsafe(`create database ${DB_NAME}`);
  await admin.end();
  const url = new URL(ADMIN_URL!);
  url.pathname = `/${DB_NAME}`;
  await applySupabaseShim(url.toString());
  await runMigrations(url.toString());
  const sql = postgres(url.toString(), { max: 2 });

  const server = createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") return send(res, 204);
      const { pathname, searchParams } = new URL(req.url ?? "/", `http://localhost:${PORT}`);

      if (pathname === "/health") return send(res, 200, { ok: true });

      if (req.method === "POST" && pathname === "/auth/v1/signup") {
        const body = await readBody(req);
        const email = String(body.email ?? "").toLowerCase();
        if (users.has(email))
          return fail(res, 422, "user_already_exists", "User already registered");
        const u: MockUser = {
          id: randomUUID(),
          email,
          password: String(body.password ?? ""),
          metadata: (body.data as Record<string, unknown>) ?? {},
        };
        users.set(email, u);
        await sql`insert into auth.users (id, email, raw_user_meta_data)
          values (${u.id}, ${email}, ${sql.json(u.metadata as never)})`;
        return send(res, 200, session(u));
      }

      if (req.method === "POST" && pathname === "/auth/v1/token") {
        const body = await readBody(req);
        const grant = searchParams.get("grant_type");
        if (grant === "password") {
          const u = users.get(String(body.email ?? "").toLowerCase());
          if (!u || u.password !== body.password) {
            return fail(res, 400, "invalid_credentials", "Invalid login credentials");
          }
          return send(res, 200, session(u));
        }
        if (grant === "refresh_token") {
          const userId = refreshTokens.get(String(body.refresh_token ?? ""));
          const u = [...users.values()].find((x) => x.id === userId);
          if (!u) return fail(res, 400, "refresh_token_not_found", "Invalid Refresh Token");
          return send(res, 200, session(u));
        }
        return fail(res, 400, "unsupported_grant_type", "unsupported grant");
      }

      if (pathname === "/auth/v1/user" && req.method === "GET") {
        const token = (req.headers.authorization ?? "").replace(/^Bearer /i, "");
        const payload = verifyJwt(token);
        const u = payload && [...users.values()].find((x) => x.id === payload.sub);
        if (!u) return fail(res, 401, "bad_jwt", "invalid JWT");
        return send(res, 200, userJson(u));
      }

      if (req.method === "POST" && pathname === "/auth/v1/logout") return send(res, 204);

      return fail(res, 404, "not_found", `mock-gotrue: ${req.method} ${pathname} no implementado`);
    } catch (error) {
      console.error(error);
      return fail(res, 500, "unexpected_failure", String(error));
    }
  });

  server.listen(PORT, () => console.log(`mock-gotrue escuchando en :${PORT} (db ${DB_NAME})`));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
