"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { SparklesCore } from "@/components/ui/sparkles";
import { VerticalCutReveal } from "@/components/ui/vertical-cut-reveal";
import Link from "next/link";

const plans = [
  {
    name: "Free",
    monthly: 0,
    yearly: 0,
    description: "Para explorar la plataforma",
    features: [
      "5 postulaciones/mes",
      "Perfil público básico",
      "Chat limitado (3 activos)",
      "Sin contratos Freelie",
      "Soporte por email",
    ],
    cta: "Empezar gratis",
    href: "/auth",
    popular: false,
  },
  {
    name: "Pro",
    monthly: 12,
    yearly: 99,
    description: "Para freelos que quieren crecer",
    features: [
      "Postulaciones ilimitadas",
      "Perfil destacado en feed",
      "Chat y contratos ilimitados",
      "Badge verificado Pro",
      "Analíticas de perfil",
      "Soporte prioritario",
    ],
    cta: "Comenzar prueba",
    href: "/auth",
    popular: true,
  },
  {
    name: "Elite",
    monthly: 48,
    yearly: 399,
    description: "Para agencias y equipos",
    features: [
      "Todo lo de Pro",
      "Hasta 5 perfiles de equipo",
      "AI Autopilot (matching automático)",
      "Boost en búsqueda",
      "API access (beta)",
      "Soporte dedicado",
    ],
    cta: "Hablar con ventas",
    href: "/auth",
    popular: false,
  },
];

function PriceDisplay({ value, prefix = "$" }: { value: number; prefix?: string }) {
  return (
    <span className="text-5xl font-bold text-white">
      {prefix}{value}
    </span>
  );
}

export function PricingSection() {
  const [yearly, setYearly] = useState(false);

  return (
    <section className="relative py-24 overflow-hidden bg-[#0A0A0F]">
      {/* Particle background */}
      <div className="absolute inset-0 z-0">
        <SparklesCore
          className="w-full h-full"
          particleColor="#905BF4"
          particleDensity={40}
          speed={0.5}
          background="transparent"
        />
      </div>

      {/* Glow ellipses */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute left-1/4 top-1/4 h-64 w-64 rounded-full blur-3xl"
          style={{ background: "rgba(144,91,244,0.15)" }} />
        <div className="absolute right-1/4 bottom-1/4 h-48 w-48 rounded-full blur-3xl"
          style={{ background: "rgba(180,112,255,0.12)" }} />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium"
            style={{ borderColor: "rgba(144,91,244,0.3)", background: "rgba(144,91,244,0.08)", color: "#B470FF" }}>
            <Sparkles className="h-4 w-4" />
            Planes simples, sin sorpresas
          </div>
          <h2 className="text-4xl font-bold text-white md:text-5xl" style={{ fontFamily: "var(--font-dm-sans)" }}>
            <VerticalCutReveal delay={0.1}>Invertí en tu</VerticalCutReveal>{" "}
            <VerticalCutReveal delay={0.3} className="text-[#905BF4]">carrera</VerticalCutReveal>
          </h2>
          <p className="mt-4 text-lg text-white/50">
            Empezá gratis. Escalá cuando estés listo.
          </p>
        </div>

        {/* Toggle */}
        <div className="mb-12 flex items-center justify-center gap-4">
          <span className={`text-sm font-medium transition-colors ${!yearly ? "text-white" : "text-white/40"}`}>
            Mensual
          </span>
          <button
            onClick={() => setYearly(!yearly)}
            className="relative h-7 w-14 rounded-full transition-colors"
            style={{ background: yearly ? "#905BF4" : "rgba(255,255,255,0.1)" }}
            aria-label="Toggle yearly billing"
          >
            <motion.div
              className="absolute top-1 h-5 w-5 rounded-full bg-white shadow"
              animate={{ x: yearly ? 30 : 2 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>
          <span className={`text-sm font-medium transition-colors ${yearly ? "text-white" : "text-white/40"}`}>
            Anual
            <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ background: "rgba(144,91,244,0.2)", color: "#B470FF" }}>
              −30%
            </span>
          </span>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="relative flex flex-col rounded-2xl p-6"
              style={{
                background: plan.popular ? "rgba(144,91,244,0.08)" : "#12121A",
                border: plan.popular ? "1px solid rgba(144,91,244,0.5)" : "1px solid rgba(255,255,255,0.06)",
                boxShadow: plan.popular ? "0px -13px 300px 0px rgba(144,91,244,0.25)" : undefined,
              }}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                    style={{ background: "linear-gradient(90deg, #905BF4, #B470FF)" }}>
                    Más popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                <p className="mt-1 text-sm text-white/40">{plan.description}</p>
              </div>

              <div className="mb-6 flex items-end gap-1">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={yearly ? "yearly" : "monthly"}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <PriceDisplay value={yearly ? plan.yearly : plan.monthly} />
                  </motion.div>
                </AnimatePresence>
                <span className="mb-2 text-sm text-white/40">
                  {plan.monthly === 0 ? "para siempre" : yearly ? "/año" : "/mes"}
                </span>
              </div>

              <ul className="mb-8 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#905BF4]" />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className="flex items-center justify-center rounded-xl py-3 text-sm font-semibold transition-colors min-h-[44px]"
                style={
                  plan.popular
                    ? { background: "linear-gradient(90deg, #905BF4, #B470FF)", color: "white" }
                    : { background: "rgba(255,255,255,0.05)", color: "white", border: "1px solid rgba(255,255,255,0.1)" }
                }
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
