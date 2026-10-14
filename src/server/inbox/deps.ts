import "server-only";
import { getServerEnv } from "@/lib/env";
import { getChannelAdapters } from "@/server/channels/env";
import { getDb } from "@/server/db";
import { GmailProvider } from "@/server/email/gmail";
import { googleConfigFromEnv } from "@/server/google/config";
import { getMailboxAccessToken } from "@/server/google/mailboxes";
import type { ReplyDeps } from "./reply";

/** Dependencias de la respuesta manual en el servidor Next. */
export function getReplyDeps(): ReplyDeps {
  const env = getServerEnv();
  const db = getDb();
  const google = googleConfigFromEnv(env);
  return {
    db,
    adapters: getChannelAdapters(),
    encryptionKey: env.TOKEN_ENCRYPTION_KEY,
    mail: google
      ? new GmailProvider(env.GMAIL_API_URL, (mailbox) =>
          getMailboxAccessToken(db, {
            accountId: mailbox.id,
            config: google,
            encryptionKey: env.TOKEN_ENCRYPTION_KEY,
          }),
        )
      : null,
    appUrl: env.APP_URL,
    unsubscribeSecret: env.UNSUBSCRIBE_SIGNING_SECRET ?? null,
  };
}
