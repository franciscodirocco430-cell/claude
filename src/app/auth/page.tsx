"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Mail, KeyRound, CheckCircle2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const CanvasRevealEffect = dynamic(
  () => import("@/components/ui/canvas-reveal-effect").then((m) => ({ default: m.CanvasRevealEffect })),
  { ssr: false }
);

type Step = "email" | "code" | "success";

export default function AuthPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setStep("code");
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setStep("success");
    setTimeout(() => router.push("/feed"), 1500);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#0A0A0F] px-4 overflow-hidden">
      {/* Three.js dot matrix background */}
      <div className="absolute inset-0 z-0">
        <CanvasRevealEffect
          color1="#905BF4"
          color2="#B470FF"
          className="h-full w-full"
        />
      </div>

      {/* Dark overlay */}
      <div className="absolute inset-0 z-0 bg-[#0A0A0F]/70" />

      {/* Mini floating navbar */}
      <nav className="absolute top-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-2xl px-4 py-2.5"
        style={{
          background: "rgba(18,18,26,0.8)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(144,91,244,0.2)",
        }}>
        <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#905BF4] to-[#B470FF] flex items-center justify-center"
          style={{ boxShadow: "0 0 12px rgba(144,91,244,0.4)" }}>
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-bold text-white" style={{ fontFamily: "var(--font-dm-sans)" }}>Freelie</span>
        <Link href="/" className="ml-4 flex items-center gap-1 text-xs text-white/50 hover:text-white transition-colors">
          <ArrowLeft className="h-3 w-3" /> Volver
        </Link>
      </nav>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl p-8"
          style={{
            background: "rgba(18,18,26,0.9)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(144,91,244,0.2)",
            boxShadow: "0 0 80px rgba(144,91,244,0.15)",
          }}>

          <AnimatePresence mode="wait">
            {step === "email" && (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ background: "rgba(144,91,244,0.15)", border: "1px solid rgba(144,91,244,0.3)" }}>
                  <Mail className="h-5 w-5 text-[#905BF4]" />
                </div>
                <h1 className="mb-1 text-2xl font-bold text-white" style={{ fontFamily: "var(--font-dm-sans)" }}>
                  Ingresá tu email
                </h1>
                <p className="mb-6 text-sm text-white/50">
                  Te enviamos un código mágico. Sin contraseñas, sin problemas.
                </p>
                <form onSubmit={handleSendCode} className="space-y-4">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vos@ejemplo.com"
                    required
                    className="w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-white/30 min-h-[44px]"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                  {error && <p className="text-xs text-red-400">{error}</p>}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50 min-h-[44px]"
                    style={{ background: "linear-gradient(90deg, #905BF4, #B470FF)" }}
                  >
                    {loading ? "Enviando..." : "Enviar código"}
                  </button>
                </form>
              </motion.div>
            )}

            {step === "code" && (
              <motion.div
                key="code"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{ background: "rgba(144,91,244,0.15)", border: "1px solid rgba(144,91,244,0.3)" }}>
                  <KeyRound className="h-5 w-5 text-[#905BF4]" />
                </div>
                <h1 className="mb-1 text-2xl font-bold text-white" style={{ fontFamily: "var(--font-dm-sans)" }}>
                  Revisá tu email
                </h1>
                <p className="mb-6 text-sm text-white/50">
                  Enviamos un código de 6 dígitos a <span className="text-white/80">{email}</span>
                </p>
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    required
                    maxLength={6}
                    className="w-full rounded-xl px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] text-white outline-none transition-colors placeholder:text-white/20 min-h-[44px]"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                  {error && <p className="text-xs text-red-400">{error}</p>}
                  <button
                    type="submit"
                    disabled={loading || code.length !== 6}
                    className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity disabled:opacity-50 min-h-[44px]"
                    style={{ background: "linear-gradient(90deg, #905BF4, #B470FF)" }}
                  >
                    {loading ? "Verificando..." : "Verificar código"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setStep("email"); setError(""); setCode(""); }}
                    className="w-full text-xs text-white/40 hover:text-white/70 transition-colors py-2"
                  >
                    Cambiar email
                  </button>
                </form>
              </motion.div>
            )}

            {step === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center py-4 text-center"
              >
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl"
                  style={{ background: "rgba(144,91,244,0.15)", border: "1px solid rgba(144,91,244,0.3)" }}>
                  <CheckCircle2 className="h-8 w-8 text-[#905BF4]" />
                </div>
                <h1 className="mb-2 text-2xl font-bold text-white" style={{ fontFamily: "var(--font-dm-sans)" }}>
                  ¡Bienvenido/a!
                </h1>
                <p className="text-sm text-white/50">Redirigiendo a tu feed...</p>
              </motion.div>
            )}
          </AnimatePresence>
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
