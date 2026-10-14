import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">No encontramos esta página</h1>
      <p className="text-muted-foreground text-sm">
        Puede que el link esté mal o que se haya movido.
      </p>
      <Button asChild>
        <Link href="/campanas">Volver al inicio</Link>
      </Button>
    </div>
  );
}
