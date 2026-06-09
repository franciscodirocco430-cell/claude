"use client";

import React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AuthForm } from "@/components/auth/auth-form";

const ShaderBackground = dynamic(
  () => import("@/components/ui/shader-background"),
  { ssr: false }
);

export default function AuthPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0A0A0F] px-4 relative">
      <ShaderBackground />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#905BF4] to-[#B470FF] flex items-center justify-center"
              style={{ boxShadow: "0 0 20px rgba(144,91,244,0.5)" }}>
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-dm-sans)" }}>
              Freelie
            </span>
          </Link>
          <p className="mt-3 text-sm text-white/50">
            Tu próximo trabajo no pide CV. Pide talento.
          </p>
        </div>

        <div className="rounded-2xl p-8"
          style={{
            background: "rgba(18,18,26,0.9)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(144,91,244,0.2)",
            boxShadow: "0 0 60px rgba(144,91,244,0.1)",
          }}>
          <AuthForm />
        </div>

        <p className="mt-6 text-center text-xs text-white/30">
          Al continuar, aceptás nuestros{" "}
          <Link href="#" className="text-[#905BF4] hover:underline">Términos</Link>{" "}
          y{" "}
          <Link href="#" className="text-[#905BF4] hover:underline">Política de Privacidad</Link>
        </p>
      </div>
    </div>
  );
}
