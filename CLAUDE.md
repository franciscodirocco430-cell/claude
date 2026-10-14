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
- `src/server/channels/outbound.ts`: `sendConversationMessage()` es el único camino de envío
  por redes; consulta `decideOutbound()` con la conversación bloqueada (`FOR UPDATE`).
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
prompts/            Prompts versionados (`<id>/vN.ts`); el puntero activo está en prompts/index.ts.
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

## IA: investigación y redacción

- **Flujo**: "Preparar mensajes" (owner/admin, máx. 100 por clic) → job `research_prospect`
  (tier FAST) → un job `draft_message` (tier SMART) por canal alcanzable → tareas en
  `outreach_tasks` (`ready` o `failed` con motivo). No se dispara solo al importar: cada
  prospecto cuesta llamadas a la API. Estado visible en `prospects.ai_status`.
- **Pipeline** en `src/server/ai/pipeline.ts`; encolado en `src/server/ai/preparation.ts`
  (transición de estado atómica: un doble clic no duplica). Fin de borradores con contador
  atómico `ai_pending_drafts` (no mirar la tabla de jobs: hay carrera entre hermanos).
- **Cliente** `AiClient` (`src/server/ai/client.ts`): SDK oficial, salida estructurada con
  `zodOutputFormat`, rechazo (`refusal`) y corte (`max_tokens`) son errores no reintentables;
  429/5xx sí. `FakeAiClient` para dev/tests (`AI_FAKE=true`, bloqueado en producción).
- **Reglas por canal** (`src/server/ai/channel-rules.ts`): van al prompt Y se validan sobre
  la salida (largo, sin links, sin marcadores). Si falla, un reintento con las correcciones;
  si insiste, la tarea queda `failed`. Email: firma y link de baja los agrega
  `composeEmailBody()` como marcadores (`{{firma}}`, `{{link_baja}}`), nunca la IA.
- **Web del prospecto** (`src/server/research/website.ts`): fetch simple con robots.txt,
  bloqueo de IPs internas en cada redirect (SSRF), sin dominios de redes sociales, timeout,
  tope de 1 MB y solo HTML. El texto de terceros va en etiquetas (`<sitio_web>`) y el prompt
  indica tratarlo como datos (defensa ante prompt injection).
- **Prompts**: cambiar un texto = nueva versión (`v2.ts`) + mover el puntero. `ai_runs.prompt_version`
  guarda `id@version`. Ejemplos few-shot: hasta 3 por canal en `campaigns.few_shot_examples`.
- **Auditoría**: cada llamada (éxito o error) → `recordAiRun()` con tokens y costo estimado
  (precios por env; caché: escritura 1,25×, lectura 0,1×).
- **Errores permanentes**: `PermanentJobError` pasa el job a `dead` sin reintentos.

## Cola del setter (modo copiloto)

- Servicio en `src/server/queue/service.ts` (todo con RLS del usuario). Entran tareas
  `ready` de campañas activas en Instagram, Facebook, TikTok y WhatsApp; el email no (sale
  automático). Se ocultan mientras la IA regenera (prospecto en queued/researching/drafting).
- Asignación: primero las del setter; si no hay, toma una libre con `FOR UPDATE SKIP LOCKED`
  (dos setters nunca reciben la misma).
- Tope diario por setter, campaña y canal (`campaigns.daily_limits`), contado desde el inicio
  del día en la zona horaria de la organización (`startOfDayInZone`). Se revalida al marcar.
- La lista de supresión se revisa al mostrar cada tarea: si está, se saltea sola.
- "Abrir y copiar" (`buildOpenUrl`): wa.me con texto prellenado, ig.me/m/<usuario>, perfil
  de TikTok, link de Facebook. `window.open` va directo en el gesto del usuario (si no, el
  navegador lo bloquea). El envío lo hace siempre la persona en la app de la red.
- "Enviado" (`markTaskSent`): tarea `sent_manual` + `sent_by`, conversación y mensaje
  saliente (autor `human`), lead a "contactado" (nunca retrocede una etapa) y saltea las
  otras tareas manuales del prospecto para no escribirle por varios canales.
- Atajos: O abrir y copiar · E enviado · S saltear · R regenerar · Ctrl+Enter enviado.
- e2e: `window.open` se reemplaza por un registro de URLs: los tests nunca abren las redes.

## Email: Gmail y secuencias

- **Conexión Gmail** (`src/app/api/oauth/google/*`, `src/server/google/`): OAuth con PKCE,
  `access_type=offline`, scopes mínimos `gmail.send` + `gmail.readonly` (este último es
  restringido: producción requiere verificación de Google). El callback exige mismo
  usuario, organización y rol admin que inició el flujo (cookie `sc_google_oauth`).
  Tokens cifrados con AAD `${id}:access|refresh`; `invalid_grant` → casilla `revoked`.
- **Secuencias** (`src/server/sequences/`): hasta 6 pasos, el primero con asunto, los
  seguimientos ≥ 1 día después y en el mismo hilo (In-Reply-To). Variables
  `{{var|defecto}}` (`src/server/email/template.ts`); una variable sin valor frena la
  inscripción (`stopped_manual` con motivo), nunca se envía con huecos. Horario hábil
  por secuencia en la zona del prospecto (o de la organización).
- **Envío** (`src/server/email/sender.ts`, jobs `send_sequence_step` / `sync_mailbox`):
  el worker despacha cada `EMAIL_DISPATCH_INTERVAL_MS`. Antes de enviar: `decideOutbound()`,
  supresión, sync del hilo, horario, límite diario y espaciado aleatorio con lock de la
  casilla (`FOR UPDATE`). Respuesta → frena todas las inscripciones del prospecto y pasa
  a "respondió"; rebote → supresión; respuesta automática se guarda pero no frena.
- **Baja**: token HMAC (`UNSUBSCRIBE_SIGNING_SECRET`). `/baja/[token]` pide un clic de
  confirmación (los escáneres de links no dan de baja); `List-Unsubscribe-Post` hace el
  one-click por POST a `/api/baja/[token]`.
- **Lecturas consistentes con auto-refresh**: si una página calcula "hay trabajo en curso"
  aparte de la lista, contá primero y listá después (si no, la vista puede quedar
  congelada con el auto-refresh apagado).

## Canales entrantes (Meta, TikTok)

- **`ChannelAdapter`** (`src/server/channels/types.ts`): `connect`, `receiveWebhook`,
  `sendMessage`, `getWindowStatus` (delega en compliance). Adapters: `MetaAdapter`
  (Instagram, Messenger, WhatsApp Cloud API), `TikTokAdapter` y `MockChannelAdapter`.
  Se arman desde env en `registry.ts`; sin credenciales, el adapter no existe (404).
- **Webhook** `/api/webhooks/[provider]` (público, autenticado por firma sobre el cuerpo
  CRUDO, tope 1 MB): Meta = handshake GET (`hub.verify_token`) + `X-Hub-Signature-256`.
  Solo encola un job `receive_inbound_message` por mensaje (clave = id del mensaje en la
  plataforma: los reintentos del proveedor no duplican). Responder rápido.
- **Asociación** (`inbound.ts`, en el worker): conversación por `externalThreadId =
"<cuenta>:<remitente>"` → prospecto por handle (redes) o teléfono E.164 (WhatsApp) →
  si no existe, se crea (`source = inbound`). Advisory lock por remitente (mensajes
  simultáneos no duplican prospectos). Reutiliza la conversación manual de la Cola. Lead a
  "respondió", tareas manuales abiertas salteadas, secuencias de email frenadas. Un
  mensaje viejo no reabre la ventana. Cuenta desconocida → job `dead`.
- Una cuenta de red social solo puede estar conectada en UNA organización (índice único).
- **Pendiente / sin verificar**: conexión real (requiere apps aprobadas; `connect()`
  devuelve `unavailable`); envío de Meta probado solo contra fixtures
  (`META_GRAPH_API_URL` sin default: poner la versión vigente); TikTok Business Messaging:
  la firma sigue la doc general de webhooks de TikTok y el formato del evento y el envío
  NO están implementados (el webhook responde 501). No inventar esos formatos.
- **Mock** (`CHANNELS_MOCK=true`, prohibido en producción salvo `APP_URL` localhost):
  cuentas de prueba y simulador en Configuración; usa el mismo camino que un webhook real.
- **Bandeja**: ver "Bandeja, CRM y ficha".

## Agente conversacional, calificación y agenda

- **Flujo**: entrante guardado → `scheduleAgentReply()` encola `agent_reply` con demora
  aleatoria (`replyDelayMin/MaxSeconds` de la campaña), clave por mensaje. Solo si la
  campaña tiene el agente activo (`campaigns.agent_settings`, Zod en
  `src/server/agent/settings.ts`, arranca APAGADO), la conversación no está pausada y el
  canal es una red (email no). Contactos nuevos entran a la campaña por defecto de la
  cuenta (`connected_accounts.settings.defaultCampaignId`).
- **Job** (`src/server/agent/agent.ts`): debounce (si llegó otro mensaje, responde el job del
  último), no responde lo ya respondido, con la ventana cerrada no gasta IA. Envía SIEMPRE por
  `sendConversationMessage()` (autor `ai`, `ai_run_id`). Prompt `prompts/agent-reply/v1.ts`
  (tier SMART), salida Zod, un reintento si la forma no valida, `ai_runs` tipo `reply`.
- **Guardas deterministas** (`guards.ts`): pedir una persona → handoff sin llamar a la IA;
  preguntar si es bot → la respuesta tiene que decir que es IA (si no, se antepone una
  aclaración; si lo niega, se reemplaza). Nunca relajar estas guardas.
- **Calificación en código**: la IA extrae respuestas (`q1…`) y criterios (`c1…`) a
  `lead_scores.answers`; el puntaje = pesos cumplidos / total. Preguntas de a una. Todas
  respondidas: puntaje < umbral → handoff; ≥ umbral → "calificado" y se ofrecen horarios.
- **Handoff**: pausa la IA (`ai_paused` + motivo) y crea `notifications` (badge en la Bandeja).
  Toggle pausar/reanudar en la conversación; reanudar reprograma el último mensaje pendiente.
- **Agenda**: Google Calendar por OAuth (`/api/oauth/google/start?para=calendario`, scopes
  `openid email calendar.events`; cuenta aparte `calendar:<email>`). Disponibilidad listando
  eventos (no freeBusy: no se pudo verificar qué scopes acepta). `findFreeSlots()` en la zona
  de la organización; los horarios ofrecidos y la confirmación los escribe el código, nunca la
  IA. Al elegir: se re-verifica, se crea el evento con id determinista (reintentos no
  duplican), `meetings` + etapa "agendado". Sin calendario: `bookingUrl` o handoff.
- `FakeAiClient` tiene un agente simulado determinista (task `agent_reply`) para dev/e2e.

## Bandeja, CRM y ficha

- **Bandeja** (`src/server/inbox/service.ts`): filtros por canal, campaña (o "sin"), etapa,
  asignado ("yo", "nadie" o un miembro) y IA pausada, como formulario GET (sin JS, URL
  compartible; `parseInboxFilters()` ignora valores inválidos). Paginada de a 50. Asignar
  solo a miembros de la organización.
- **Respuesta manual** (`src/server/inbox/reply.ts`): redes por `sendConversationMessage()`
  (autor `human`); ventana vencida o tope de TikTok → tarea `ready` en la Cola, nunca envío;
  WhatsApp fuera de ventana → bloqueado (plantillas pendientes). Email: mismo hilo
  (In-Reply-To al último mensaje, "Re:"), firma y link de baja, respeta supresión. Al
  enviar: se asigna a quien respondió (si nadie la tenía) y se pausa la IA.
- **CRM** (`src/server/pipeline/board.ts`, `src/components/crm/pipeline-board.tsx`): una
  columna por etapa, tarjeta por lead (prospecto × campaña), hasta 100 por columna.
  `@dnd-kit/core` con mouse, touch (mantener apretado) y teclado + un `select` por tarjeta
  como alternativa (celular y lectores de pantalla). UI optimista; las actualizaciones
  después de un `await` vuelven a `startTransition` (sin parpadeo). Una persona puede mover
  a cualquier etapa (también hacia atrás); la automatización nunca retrocede.
- **Ficha** (`/prospectos/[pid]`, `src/server/prospects/record.ts`): historial de todas
  las conversaciones (todos los canales, últimos 500 mensajes), puntaje y respuestas por
  campaña, investigación, reuniones, tareas y secuencias. La página de la campaña sigue
  teniendo borradores y acciones de IA.
- `select` no controlado que refleja un valor del servidor: ponele `key` con ese valor
  (solo lee `defaultValue` al montarse).

## Métricas

- **Página** `/metricas` + export `/api/metricas/csv?vista=campanas|canales|setters` (con RLS,
  mismos filtros). Período en la zona de la organización (`parsePeriod()`: por defecto 30
  días, ambos extremos incluidos, máximo 1 año).
- **Definiciones** (`src/server/metrics/service.ts`, una vez y en código): enviados =
  salientes del período; contactados = prospectos con saliente en el período; respondieron
  = escribieron después de ese primer saliente (por canal, en ese canal); calificados =
  entraron a calificado/agendado/ganado en el período; agendados = reuniones creadas;
  costo = suma de `ai_runs.cost_usd` (corridas sin precio se informan aparte).
  Atribución: setter = autor del mensaje (`__ai__` IA, `__auto__` secuencias); para
  calificados/agendados, canal de la primera respuesta y setter del primer envío. El costo
  de IA no se atribuye a setters.
- **Historial de etapas** (`lead_stage_events`): lo escribe un trigger `SECURITY DEFINER`
  sobre `lead_scores` (alta o cambio de `stage_id`, actor = `auth.uid()`). Ningún código lo
  escribe a mano; los usuarios solo lo leen. Backfill aproximado con `updated_at`.
- **Cálculo**: SQL trae filas atribuidas (`loadRawMetrics`) y la agregación es pura
  (`aggregate.ts`, testeada). CSV con BOM, CRLF y neutralización de fórmulas (`csv.ts`).

## Tests e2e sin Docker

`e2e/support/mock-gotrue.ts` emula lo mínimo de Supabase Auth (signup con autoconfirm,
login, refresh, `/user`, logout) y recrea la base `setter_e2e` (shim + migraciones).
`e2e/support/mock-google.ts` emula OAuth de Google y la API de Gmail (envío, hilos y
`/__test/reply` para simular respuestas y rebotes).
Playwright levanta el mock, el worker (con `AI_FAKE=true` y health check) y la app
(`pnpm build && pnpm start`). `E2E_REUSE_SERVER=1` reutiliza servidores ya levantados. Si tenés Supabase
local, los mismos specs deberían pasar apuntando a él, pero eso todavía no se verificó.

## Supabase local vs. Postgres pelado

Las migraciones las maneja Drizzle (`drizzle/`), no `supabase/migrations`. Con Supabase
local: `pnpm supabase:start && pnpm db:migrate && pnpm db:seed`. Sin Docker (CI), los
tests de base aplican `scripts/db/supabase-shim.sql` (roles `anon`/`authenticated`/
`service_role`, `auth.users`, `auth.uid()`) sobre un Postgres 15+ antes de migrar.
