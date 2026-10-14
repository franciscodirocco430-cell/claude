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
pnpm db:seed
pnpm dev
```

Reglas de cumplimiento, convenciones y todos los comandos: ver [CLAUDE.md](./CLAUDE.md).
