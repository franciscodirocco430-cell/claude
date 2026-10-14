import { Sparkles } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md">
          <Sparkles className="size-4" aria-hidden />
        </span>
        Setter Copilot
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
