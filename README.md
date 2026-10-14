# Setter Copilot

Prospección multicanal asistida por IA: el setter envía los primeros mensajes en redes
desde una cola con un clic, el email en frío sale automático con secuencias, y la IA
continúa las conversaciones por canales oficiales dentro de las ventanas permitidas.

## Empezar

Requisitos: Node 22+, pnpm 10, Docker (para Supabase local).

```bash
pnpm install
cp .env.example .env            # completá las claves
pnpm supabase:start             # copiá anon key y service role key al .env
pnpm db:migrate
pnpm db:seed                    # opcional: datos de ejemplo
pnpm dev
```

Entrá a http://localhost:3000/registro y creá tu cuenta: se crea tu organización y
quedás como owner. Los usuarios del seed son solo dueños de datos de ejemplo y no
tienen contraseña.

Tests: `pnpm check`, `pnpm test:db` y `pnpm test:e2e` (los dos últimos necesitan
`TEST_DATABASE_URL`).

Reglas de cumplimiento, convenciones y todos los comandos: ver [CLAUDE.md](./CLAUDE.md).
