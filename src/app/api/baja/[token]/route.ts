import { NextResponse, type NextRequest } from "next/server";
import { getServerEnv } from "@/lib/env";
import { getDb } from "@/server/db";
import { unsubscribeEmail } from "@/server/email/sender";
import { verifyUnsubscribeToken } from "@/server/email/unsubscribe";

type Params = { params: Promise<{ token: string }> };

/** Baja en un clic (RFC 8058): Gmail hace POST con "List-Unsubscribe=One-Click". */
export async function POST(_request: NextRequest, { params }: Params) {
  const { token } = await params;
  const secret = getServerEnv().UNSUBSCRIBE_SIGNING_SECRET;
  const payload = secret ? verifyUnsubscribeToken(token, secret) : null;
  if (!payload) return new NextResponse("Link inválido", { status: 400 });
  await unsubscribeEmail(getDb(), { organizationId: payload.o, email: payload.e });
  return new NextResponse("OK", { status: 200 });
}

/** Si alguien abre el link del encabezado en el navegador, va a la página de confirmación. */
export async function GET(request: NextRequest, { params }: Params) {
  const { token } = await params;
  return NextResponse.redirect(
    new URL(`/baja/${encodeURIComponent(token)}`, request.nextUrl.origin),
  );
}
