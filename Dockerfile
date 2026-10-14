# Imagen del WORKER (jobs en segundo plano). La app web se deploya en Vercel.
# Se ejecuta con tsx sobre el código fuente: mismos alias (@/, @prompts/) que en dev.
FROM node:22-bookworm-slim

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true
RUN corepack enable

WORKDIR /app

# Solo dependencias de producción (sin Playwright, Supabase CLI, etc.).
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY tsconfig.json ./
COPY src ./src
COPY prompts ./prompts
COPY worker ./worker
COPY scripts/db ./scripts/db
COPY scripts/deploy ./scripts/deploy
COPY drizzle ./drizzle

ENV NODE_ENV=production \
    WORKER_HEALTH_PORT=8080
EXPOSE 8080

# Sin root: el worker no necesita privilegios.
USER node

# Sin pnpm en runtime (no descarga nada al arrancar). Migraciones:
#   node_modules/.bin/tsx scripts/db/migrate.ts
# SIGTERM → el worker deja de tomar jobs y termina los que tiene en curso.
CMD ["node_modules/.bin/tsx", "worker/index.ts"]
