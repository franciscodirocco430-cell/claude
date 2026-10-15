import { Sparkles } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col items-center justify-center gap-8 overflow-hidden px-4 py-10">
      <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="aurora" />
        <div className="bg-primary/20 animate-float-slow absolute -bottom-32 -left-24 size-80 rounded-full blur-3xl" />
      </div>

      <div className="animate-in fade-in slide-in-from-top-2 flex flex-col items-center gap-3 text-center duration-500">
        <span className="brand-mark flex size-11 items-center justify-center rounded-xl">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <div className="space-y-1">
          <p className="text-2xl font-semibold tracking-tight">
            Setter <span className="text-gradient">Copilot</span>
          </p>
          <p className="text-muted-foreground text-sm">Prospección multicanal asistida por IA</p>
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-bottom-4 [&>[data-slot=card]]:glass w-full max-w-sm duration-500 [&>[data-slot=card]]:shadow-xl">
        {children}
      </div>
    </div>
  );
}
