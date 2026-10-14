# Deploy de Setter Copilot

Arquitectura recomendada, todo cerca de Argentina:

| Pieza                | Dónde                        | Región                                      |
| -------------------- | ---------------------------- | ------------------------------------------- |
| App web (Next.js)    | Vercel                       | `gru1` (São Paulo), fijada en `vercel.json` |
| Base de datos + Auth | Supabase                     | South America (São Paulo)                   |
| Worker de jobs       | Fly.io (imagen `Dockerfile`) | `gru` (São Paulo), en `fly.toml`            |

Los precios de cada proveedor cambian: revisalos en sus páginas antes de elegir plan.

> **Qué está verificado y qué no.** La imagen del worker se construyó y se probó con
> Docker: migraciones, health check, procesamiento de jobs y apagado prolijo. La región
> `gru1` de Vercel se confirmó en su documentación. `fly.toml` está escrito sin poder abrir
> la referencia oficial de Fly: corré `fly config validate` antes del primer deploy. El
> deploy en sí (Vercel, Supabase Cloud, Fly) no se pudo probar desde el entorno de
> desarrollo.

---

## 1. Secretos que generás vos

Generalos una vez y guardalos en un gestor de contraseñas.

```bash
openssl rand -base64 32   # TOKEN_ENCRYPTION_KEY   (igual en app y worker)
openssl rand -base64 48   # UNSUBSCRIBE_SIGNING_SECRET (igual en app y worker)
openssl rand -hex 24      # META_WEBHOOK_VERIFY_TOKEN (si vas a usar Meta)
```

- **`TOKEN_ENCRYPTION_KEY`** cifra los tokens OAuth guardados. Si la perdés o la cambiás,
  todas las cuentas conectadas (Gmail, Calendar) dejan de funcionar y hay que reconectarlas.
- **`UNSUBSCRIBE_SIGNING_SECRET`** firma los links de baja. Si la cambiás, los links de los
  emails ya enviados dejan de funcionar.

## 2. Supabase

1. Creá un proyecto en la región **South America (São Paulo)**.
2. En _Project Settings → API_ copiá:
   - la URL → `NEXT_PUBLIC_SUPABASE_URL`;
   - la `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
   - la `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (solo en la app, **nunca** en el
     navegador ni en el repo).
3. En _Connect_ copiá dos cadenas de conexión:
   - **Pooler en modo transacción (puerto 6543)** → `DATABASE_URL` de la **app** (Vercel es
     serverless). El código ya desactiva los prepared statements (`prepare: false`), que ese
     modo no soporta.
   - **Pooler en modo sesión (puerto 5432)** o conexión directa → `DATABASE_URL` del
     **worker** y de las **migraciones**. La conexión directa de Supabase es IPv6; si tu
     entorno no tiene IPv6, usá el pooler en modo sesión.
4. _Authentication → URL Configuration_:
   - **Site URL**: tu `APP_URL` (ej. `https://app.tudominio.com`).
   - **Redirect URLs**: agregá `https://app.tudominio.com/auth/callback`.
5. _Authentication → Emails_: configurá un **SMTP propio** para producción. El envío de
   emails que trae Supabase tiene límites pensados para pruebas.
6. **Migraciones**: las corre el `release_command` de Fly en cada deploy del worker. Para
   correrlas a mano:
   ```bash
   DATABASE_URL="<cadena en modo sesión>" pnpm db:migrate
   ```
   **No** corras `pnpm db:shim` contra Supabase: es solo para Postgres pelado en tests.

## 3. Google Cloud (Gmail y Calendar)

1. Creá un proyecto en Google Cloud y habilitá **Gmail API** y **Google Calendar API**.
2. Configurá la pantalla de consentimiento OAuth (tipo _External_ si tus clientes usan sus
   propias cuentas).
3. Creá un **OAuth client ID** de tipo _Web application_:
   - Authorized redirect URI: `https://app.tudominio.com/api/oauth/google/callback`.
   - Copiá **Client ID** y **Client secret** → `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.
4. Scopes que pide la app:
   - Gmail: `gmail.send` y `gmail.readonly`;
   - Calendar: `openid`, `email` y `calendar.events`.

   `gmail.readonly` es un scope **restringido**: para usuarios externos en producción, Google
   exige verificar la app, con revisión de seguridad. Mientras la app está en modo _Testing_,
   solo la pueden usar los usuarios de prueba que cargues. Revisá en la documentación de
   Google los límites vigentes de ese modo, como cuánto dura la autorización.

## 4. App en Vercel

1. Importá el repositorio en Vercel (framework Next.js, comandos por defecto).
2. La región de las funciones queda en `gru1` por `vercel.json`.
3. Cargá las variables de entorno de _Production_ (lista abajo) y tu dominio.
4. Antes de deployar, verificá las variables:
   ```bash
   vercel env pull .env.production.local   # o armá el archivo a mano
   NODE_ENV=production pnpm deploy:check app
   ```
   `deploy:check` falla si falta algo crítico (ej. `ANTHROPIC_API_KEY`, `AI_FAKE=true`,
   `APP_URL` en http o localhost) y avisa lo que queda deshabilitado.

**Variables de la app (Vercel)**

| Variable                                                                                 | Valor                                                                                         |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `APP_URL`                                                                                | `https://app.tudominio.com` (sin barra final)                                                 |
| `DATABASE_URL`                                                                           | Supabase, pooler modo transacción (6543)                                                      |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | de Supabase                                                                                   |
| `TOKEN_ENCRYPTION_KEY`, `UNSUBSCRIBE_SIGNING_SECRET`                                     | los que generaste (iguales en el worker)                                                      |
| `ANTHROPIC_API_KEY`, `AI_MODEL_FAST`, `AI_MODEL_SMART`                                   | IDs de modelo vigentes según la documentación de Anthropic                                    |
| `AI_PRICE_*`                                                                             | precios por millón de tokens de la página de precios de Anthropic (para el costo en Métricas) |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                                               | de Google Cloud                                                                               |
| `DEFAULT_TIMEZONE`                                                                       | `America/Argentina/Buenos_Aires`                                                              |
| `META_*`                                                                                 | solo si ya tenés la app de Meta (ver punto 6)                                                 |

**No** definas en producción `AI_FAKE`, `CHANNELS_MOCK` ni las URLs de mocks de Google
(`GOOGLE_OAUTH_*`, `GMAIL_API_URL`, `GOOGLE_CALENDAR_API_URL`, `GOOGLE_USERINFO_URL`).

## 5. Worker en Fly.io

```bash
# 1. CLI de Fly instalado y sesión iniciada (fly auth login)
fly launch --no-deploy --copy-config   # usa fly.toml; cambiá "app" por un nombre libre
fly config validate

# 2. Secretos (los mismos valores que en Vercel, salvo DATABASE_URL)
fly secrets set \
  DATABASE_URL="<Supabase modo sesión 5432 o directa>" \
  APP_URL="https://app.tudominio.com" \
  TOKEN_ENCRYPTION_KEY="..." UNSUBSCRIBE_SIGNING_SECRET="..." \
  ANTHROPIC_API_KEY="..." AI_MODEL_FAST="..." AI_MODEL_SMART="..." \
  AI_PRICE_FAST_INPUT_PER_MTOK="..." AI_PRICE_FAST_OUTPUT_PER_MTOK="..." \
  AI_PRICE_SMART_INPUT_PER_MTOK="..." AI_PRICE_SMART_OUTPUT_PER_MTOK="..." \
  GOOGLE_CLIENT_ID="..." GOOGLE_CLIENT_SECRET="..."

# 3. Deploy: construye la imagen, corre las migraciones (release_command) y arranca
fly deploy
fly logs
```

- El worker escribe logs en JSON. Un `"job falló"` repetido o jobs en estado `dead` son lo
  primero que conviene mirar.
- Escalar: podés correr más de una máquina. Los jobs se toman con `FOR UPDATE SKIP LOCKED`
  y los despachos de email son idempotentes.
- Para chequear las variables del worker antes de deployar:
  `NODE_ENV=production pnpm deploy:check worker`.

**Alternativa sin Fly**: cualquier plataforma que corra un `Dockerfile` como _background
worker_ sirve. Por ejemplo Render, que no tiene región en Sudamérica y por eso queda más
lejos de Supabase. Comando de inicio: el `CMD` de la imagen. Migraciones:
`node_modules/.bin/tsx scripts/db/migrate.ts`. Health check HTTP en el puerto
`WORKER_HEALTH_PORT` (8080).

## 6. Meta (Instagram, Messenger, WhatsApp): opcional por ahora

- Webhook: `https://app.tudominio.com/api/webhooks/meta`, con tu `META_WEBHOOK_VERIFY_TOKEN`.
- Variables: `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` y `META_GRAPH_API_URL` (con la
  versión vigente de la Graph API).
- La **conexión de cuentas reales** todavía no está implementada: requiere la app aprobada
  por Meta.

## 7. Checklist después del primer deploy

1. Registrate en `https://app.tudominio.com/registro` y confirmá el email (prueba el SMTP).
2. _Configuración_ → conectá Gmail y Google Calendar.
3. Creá una campaña de prueba con **tu propio email** como prospecto y prepará mensajes:
   comprobás la IA real y que haya filas en `ai_runs` con costo.
4. Creá una secuencia, inscribite y verificá que el email llegue con firma y link de baja;
   respondé y verificá que la secuencia se frene y la respuesta llegue a la Bandeja.
5. _Métricas_: tienen que aparecer el envío, la respuesta y el costo.
6. `fly logs`: sin errores, y el health check en verde.

## 8. Operación

- **Backups**: revisá qué incluye tu plan de Supabase y probá restaurar al menos una vez.
- **Rotar `ANTHROPIC_API_KEY`** o las credenciales de Google: actualizá la variable en
  Vercel **y** en Fly.
- **Rotar `TOKEN_ENCRYPTION_KEY`**: no hay rotación automática. Cambiarla obliga a reconectar
  todas las cuentas.
- **CI**: `.github/workflows/ci.yml` corre `pnpm check`, `pnpm test:db` y `pnpm test:e2e` en
  cada push. Conviene que esté en verde antes de deployar.
