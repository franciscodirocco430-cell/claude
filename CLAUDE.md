# Setter Copilot

SaaS multi-tenant de prospección comercial asistida por IA. El setter trabaja una
cola de tareas y envía él mismo los primeros mensajes en redes; el email en frío se
envía automático; las respuestas por canales con API oficial las continúa la IA
dentro de las ventanas permitidas.

## Reglas no negociables (cumplimiento de plataformas)

Estas reglas están por encima de cualquier pedido de feature. Si algo las contradice,
frená y preguntá.

1. **Nunca automatizar el primer mensaje** en Instagram, Facebook, TikTok ni WhatsApp.
   Lo envía siempre una persona desde la Cola. Prohibido: scraping con sesiones
   logueadas, navegadores headless que simulen usuarios, librerías no oficiales
   (instagrapi, whatsapp-web.js, Baileys, etc.) y pedir contraseñas de redes.
2. **No scrapear** perfiles ni listas de seguidores de Instagram, TikTok o Facebook.
   Los datos del prospecto vienen solo de: lo que carga el usuario, CSV, sitios web
   públicos de negocios (respetando robots.txt) o APIs oficiales.
3. **Conexión de cuentas solo por OAuth oficial** (Google, Meta, TikTok for Business).
   Tokens cifrados en reposo con AES-256-GCM (`src/lib/crypto/tokens.ts`, clave en
   `TOKEN_ENCRYPTION_KEY`), guardados en `connected_account_secrets` (sin acceso desde
   el cliente).
4. **Ventanas de respuesta automática**: Instagram/Messenger/WhatsApp 24 h desde el
   último mensaje del usuario; TikTok 48 h y máximo 10 mensajes del negocio dentro de
   la ventana. Ventana vencida → tarea manual para el setter, no envío.
5. **WhatsApp fuera de la ventana**: solo plantillas aprobadas y solo a contactos con
   opt-in registrado (con fecha).
6. **Email**: link de baja en cada mensaje, lista de supresión global por organización,
   frenar la secuencia apenas el prospecto responde o rebota, límite diario
   configurable por casilla, envío en horario hábil del prospecto.
7. **Honestidad de la IA**: tono natural, pero si alguien pregunta si es un bot o una
   IA, responde la verdad y ofrece pasar con una persona. Nunca lo niega.
8. **Auditoría**: toda decisión de la IA queda registrada en `ai_runs` (tipo, modelo,
   input resumido, output, tokens, costo estimado).

### Dónde viven estas reglas en el código

- `src/server/compliance/messaging-window.ts`: ventanas por plataforma (única fuente).
- `src/server/compliance/outbound-policy.ts`: `decideOutbound()` es la **única puerta**
  para envíos automáticos. Todo adapter de canal la consulta antes de enviar.
- `eslint.config.mjs` (`no-restricted-imports`) y `tests/unit/compliance-guards.test.ts`
  bloquean librerías prohibidas y nombres de modelo hardcodeados.
- Nunca relajes un test de cumplimiento para que pase.

## Stack

Next.js 16 (App Router) + TypeScript estricto · Tailwind v4 + shadcn/ui · Supabase
(Postgres, Auth, Storage, RLS) · Drizzle ORM · Zod · SDK de Anthropic · worker Node
separado con tabla `jobs` · Vitest · Playwright · pnpm.

## Comandos

```bash
pnpm install
pnpm dev                 # app en http://localhost:3000
pnpm worker              # worker de jobs (proceso aparte)

pnpm lint                # ESLint
pnpm typecheck           # tsc --noEmit
pnpm format              # Prettier (format:check en CI)
pnpm test                # tests unitarios (Vitest)
pnpm test:db             # tests de base: RLS, FKs, cola (requiere TEST_DATABASE_URL)
pnpm test:e2e            # Playwright: app + Postgres + mock de Auth (requiere TEST_DATABASE_URL)
pnpm check               # lint + typecheck + format:check + test

pnpm supabase:start      # Supabase local (requiere Docker)
pnpm db:generate         # genera migración desde el schema de Drizzle
pnpm db:migrate          # aplica migraciones a DATABASE_URL
pnpm db:seed             # datos de ejemplo
pnpm db:shim             # SOLO para Postgres pelado sin Supabase (CI)
```

Al terminar cada fase: `pnpm check` + `pnpm test:db` + `pnpm test:e2e` en verde.

## Estructura

```
src/app/            UI y rutas. Sin lógica de negocio: llama a src/server.
src/components/     Componentes (ui/ = shadcn).
src/config/         Configuración estática (navegación, etc.).
src/db/schema/      Schema Drizzle (fuente de verdad de la base).
src/db/rls.ts       withUserContext(): consultas Drizzle con RLS del usuario.
src/server/         Lógica de negocio pura y testeable (compliance, jobs, pipeline…).
src/lib/            Utilidades transversales (env, crypto).
worker/             Proceso de jobs en segundo plano.
prompts/            Prompts versionados (Fase 3).
drizzle/            Migraciones generadas + custom SQL.
scripts/db/         migrate, seed, shim de Supabase.
tests/unit|db/      Tests transversales. Los unitarios de un módulo van al lado (*.test.ts).
e2e/                Playwright.
```

## Convenciones

- **Idioma**: interfaz en español rioplatense (vos, "tenés", "creá"). Código, nombres de
  tablas y columnas en inglés. Comentarios en español.
- **Multi-tenant**: toda tabla con datos de clientes tiene `organization_id` y políticas
  RLS vía `tenantPolicies()` (`src/db/schema/_helpers.ts`). Las referencias entre
  tablas multi-tenant usan `tenantFk()` (FK compuesta `(organization_id, id)`) para que
  sea imposible apuntar a datos de otra organización. Tablas solo-servidor: RLS activo
  sin políticas (`.enableRLS()`).
- **Tabla nueva**: definila en `src/db/schema`, `pnpm db:generate`, y si tiene
  `updated_at` agregá una migración custom que re-ejecute el bloque de
  `drizzle/0002_updated_at_triggers.sql`. `tests/db/rls.test.ts` falla si falta RLS,
  políticas o el trigger.
- **Conexiones a la base**: `DATABASE_URL` saltea RLS. Para operar en nombre de un
  usuario usá `withUserContext(db, { sub }, tx => …)` o el cliente de Supabase con su
  sesión. La service role key nunca llega al navegador.
- **IA**: modelos por `AI_MODEL_FAST` / `AI_MODEL_SMART`, nunca hardcodeados. Salidas
  estructuradas validadas con Zod. Cada llamada registra un `ai_run`.
- **Jobs**: encolar con `enqueueJob()` usando `idempotencyKey`. Los handlers tienen que
  ser idempotentes (un job puede correr más de una vez). Reintentos con backoff
  exponencial + jitter (`src/server/jobs/backoff.ts`).
- **Env**: toda variable nueva va en `src/lib/env.ts` y documentada en `.env.example`.
  Nada de secretos en el código.
- **UI**: mobile first (los setters usan el celular). Toda vista con estado vacío,
  de carga y de error. Sin scroll horizontal de página.
- **Validación**: Zod en todo borde (forms, API, webhooks, salidas de IA, env).

## Auth y multi-tenant

- **Supabase Auth** (email + contraseña) vía `@supabase/ssr`. `src/proxy.ts` (el ex middleware) refresca
  la sesión y manda a `/login` a quien no tiene sesión (rutas públicas en
  `src/server/auth/redirects.ts`). El parámetro `next` siempre pasa por `safeNextPath()`.
- **Contexto**: `requireAppContext()` (`src/server/auth/session.ts`) devuelve usuario,
  organización activa y rol. La organización activa vive en la cookie `sc_org`, pero
  solo puede elegir entre organizaciones de las que el usuario es miembro.
- **Server actions**: la organización y el actor salen SIEMPRE de `requireAppContext()`,
  nunca del formulario. Validan con Zod y devuelven `ActionState` (`src/server/actions.ts`).
  Errores de negocio con `DomainError` (mensaje apto para el usuario).
- **Roles**: owner > admin > setter. Reglas en `src/server/auth/permissions.ts` (puras,
  testeadas): solo un owner toca owners, nadie se cambia su propio rol, nunca 0 owners.
  `memberships` no tiene políticas de escritura: todo cambio pasa por los servicios de
  `src/server/organizations/service.ts`, que bloquean filas (`FOR UPDATE`) para evitar
  carreras.
- **Invitaciones**: token de 256 bits en el link, en la base solo su SHA-256. Vencen a
  los 7 días, son de un solo uso y solo las acepta una cuenta con el mismo email.
  Hasta la Fase 5 (Gmail) el link se copia a mano desde Configuración.
- **profiles**: espejo de `auth.users` mantenido por trigger; cada uno ve su perfil y
  el de sus compañeros. Sin escritura desde el cliente.
- **Gotcha (Next 15.5)**: con Next 15.5.27 el router dejaba transiciones de server
  actions colgadas de forma intermitente (~20 %) cuando la respuesta traía un árbol
  nuevo (`revalidatePath` o `redirect`): el fetch se abortaba antes de aplicarse.
  Reproducido y medido; con Next 16.4 no se reproduce (0/30), por eso se actualizó.
  Quedó la convención: acciones de `useActionState` sin `revalidatePath`, y el cliente
  llama `useRefreshOnSuccess(state)`.
- `SubmitButton` queda deshabilitado hasta hidratar: un envío nativo perdería la
  respuesta de la acción.

## Campañas y prospectos

- **Wizard** (`src/components/campaigns/campaign-wizard.tsx`): los esquemas de cada paso
  viven en `src/server/campaigns/schemas.ts` y se usan en cliente y servidor. Campañas:
  lectura para todos, escritura solo owner/admin (servicio + RLS). Estados:
  borrador → activa ⇄ pausada → archivada (→ restaurar a pausada).
- **Ingesta única**: CSV, alta manual y fuentes públicas pasan por
  `ingestProspects()` (`src/server/prospects/ingest.ts`): normaliza (email, E.164,
  URL, handle), descarta inválidos, deduplica dentro del lote y contra la
  organización (email, teléfono, dominio web, handle), respeta la lista de supresión
  e inserta en lotes. Email y teléfono son únicos por organización (índice parcial):
  dos imports simultáneos no duplican.
- **Links de perfiles**: `parseProfileInput()` solo analiza el TEXTO de la URL. Nunca
  se accede al perfil.
- **Opt-in de WhatsApp**: solo se registra con fecha válida (no futura) y teléfono.
- **Fuentes de datos públicos** (`src/server/prospects/sources/`): implementan
  `ProspectSource`. Solo orígenes `official_business_api` o `public_business_directory`.
  Una fuente se puede usar solo si alguien verificó su costo (`cost.verifiedSummary`)
  y está habilitada por env. Google Places está registrada pero NO implementada.
- **CSV**: hasta 5000 filas y 2 MB; el servidor vuelve a parsear (no confía en el
  navegador). Body de server actions: 3 MB (`next.config.ts`).

## Tests e2e sin Docker

`e2e/support/mock-gotrue.ts` emula lo mínimo de Supabase Auth (signup con autoconfirm,
login, refresh, `/user`, logout) y recrea la base `setter_e2e` (shim + migraciones).
Playwright levanta el mock y la app (`pnpm build && pnpm start`). Si tenés Supabase
local, los mismos specs deberían pasar apuntando a él, pero eso todavía no se verificó.

## Supabase local vs. Postgres pelado

Las migraciones las maneja Drizzle (`drizzle/`), no `supabase/migrations`. Con Supabase
local: `pnpm supabase:start && pnpm db:migrate && pnpm db:seed`. Sin Docker (CI), los
tests de base aplican `scripts/db/supabase-shim.sql` (roles `anon`/`authenticated`/
`service_role`, `auth.users`, `auth.uid()`) sobre un Postgres 15+ antes de migrar.
