"use client";

import React from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Zap,
  Shield,
  FileText,
  Star,
  ArrowRight,
  CheckCircle,
  MessageCircle,
  Trophy,
  Users,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ShaderBackground = dynamic(
  () => import("@/components/ui/shader-background"),
  { ssr: false }
);

const steps = [
  {
    number: "01",
    title: "Creá tu perfil",
    description: "Registrate en 3 minutos. Agregá tus skills, portafolio y tarifa. Sin CV, sin experiencia previa obligatoria.",
    icon: Users,
  },
  {
    number: "02",
    title: "Matcheá y negociá",
    description: "Encontrá proyectos que se adapten a tu stack. Enviá propuestas, negociá milestones en el chat.",
    icon: MessageCircle,
  },
  {
    number: "03",
    title: "Entregá y crecé",
    description: "Completá contratos, sumá XP, desbloqueá badges y construí tu reputación verificada en LATAM.",
    icon: TrendingUp,
  },
];

const testimonials = [
  {
    name: "Valentina R.",
    role: "Diseñadora UX",
    xp: "Senior · 680 XP",
    quote: "En 2 semanas ya tenía mi primer contrato. El sistema de XP me ayudó a mostrar mi nivel sin depender de un portfolio enorme.",
    avatar: "https://picsum.photos/seed/val/64/64",
  },
  {
    name: "Marcos D.",
    role: "Dev Full Stack",
    xp: "Elite · 920 XP",
    quote: "La comisión del 1% es una locura comparado con Workana. Y el chat sin fugas hace que todo pase dentro de la plataforma.",
    avatar: "https://picsum.photos/seed/marc/64/64",
  },
  {
    name: "Lucía F.",
    role: "Directora de Marketing",
    xp: "Freelier verificada",
    quote: "Encontré un dev en 3 horas. El contrato se generó en el chat y los milestones se pagaron solos. Es lo que necesitaban las PYMEs.",
    avatar: "https://picsum.photos/seed/luc/64/64",
  },
];

const pricingTiers = [
  {
    name: "Free",
    price: "0",
    description: "Para empezar a conocer la plataforma",
    features: [
      "3 matches por mes",
      "1 propuesta activa",
      "Perfil básico",
      "Contratos in-app",
    ],
    cta: "Empezar gratis",
    href: "/auth",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "19",
    description: "Para freelos que quieren crecer en serio",
    features: [
      "Matches ilimitados",
      "5 propuestas activas",
      "Badges visibles en el feed",
      "Prioridad en el algoritmo",
      "Soporte prioritario",
    ],
    cta: "Activar Pro",
    href: "/auth",
    highlighted: true,
  },
  {
    name: "Elite",
    price: "49",
    description: "Para los que quieren dominar el mercado",
    features: [
      "Todo lo de Pro",
      "Propuestas ilimitadas",
      "Badge Featured en el feed",
      "Matching con IA (V2)",
      "Autopilot IA (próximamente)",
    ],
    cta: "Ir a Elite",
    href: "/auth",
    highlighted: false,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] text-white">
      <ShaderBackground />

      {/* NAV — Floating pill glassmorphism */}
      <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-5xl">
        <nav
          className="rounded-full px-5 py-3 flex items-center justify-between"
          style={{
            background: "rgba(255,255,255,0.05)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#905BF4] to-[#B470FF] flex items-center justify-center"
              style={{ boxShadow: "0 0 16px rgba(144,91,244,0.5)" }}>
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white" style={{ fontFamily: "var(--font-dm-sans)" }}>
              Freelie
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm text-white/70">
            <Link href="#features" className="hover:text-white transition-colors">Cómo funciona</Link>
            <Link href="#pricing" className="hover:text-white transition-colors">Precios</Link>
            <Link href="#testimonials" className="hover:text-white transition-colors">Testimonios</Link>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/auth" className="text-sm text-white/70 hover:text-white transition-colors px-3 py-2">
              Iniciar sesión
            </Link>
            <Link
              href="/auth"
              className="bg-[#905BF4] hover:bg-[#7C3AED] text-white text-sm font-semibold px-4 py-2 rounded-full transition-colors min-h-[44px] flex items-center"
            >
              Empezar gratis
            </Link>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section className="relative px-4 pt-40 pb-24 sm:pt-52 sm:pb-32 text-center">
        <div className="mx-auto max-w-5xl relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#905BF4]/30 bg-[#905BF4]/10 px-4 py-2 text-sm font-medium text-[#B470FF] mb-8">
            <Zap className="h-3.5 w-3.5" />
            <span>Marketplace para talento digital LATAM</span>
          </div>

          <h1 className="text-5xl font-bold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl text-white mb-6"
            style={{ fontFamily: "var(--font-dm-sans)" }}>
            Tu próximo trabajo{" "}
            <br className="hidden sm:block" />
            no pide CV.{" "}
            <span style={{ background: "linear-gradient(135deg, #905BF4, #B470FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Pide talento.
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg text-white/60 sm:text-xl mb-10">
            Conectamos jóvenes profesionales con PYMEs que necesitan talento real, ahora.
            1% de comisión, contratos in-app y reputación que se construye desde el primer día.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/auth"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#905BF4] hover:bg-[#7C3AED] text-white h-14 px-8 rounded-2xl text-base font-semibold transition-all min-h-[44px]"
              style={{ boxShadow: "0 0 40px rgba(144,91,244,0.4)" }}
            >
              Soy Freelo <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/auth"
              className="w-full sm:w-auto flex items-center justify-center border border-[#905BF4]/40 text-white hover:bg-[#905BF4]/10 h-14 px-8 rounded-2xl text-base font-semibold transition-colors min-h-[44px]"
            >
              Busco Talento
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-white/40">
            {["1% de comisión", "Chat anti-leakage", "Contratos in-app", "XP gamificado", "Gratis para empezar"].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-[#905BF4]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INTEREST — Bento Features */}
      <section id="features" className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-white mb-4"
              style={{ fontFamily: "var(--font-dm-sans)" }}>
              Todo lo que necesitás para{" "}
              <span style={{ background: "linear-gradient(135deg, #905BF4, #B470FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                trabajar mejor
              </span>
            </h2>
            <p className="text-white/50 max-w-xl mx-auto">
              Herramientas construidas para el freelancer moderno y la PYME que quiere moverse rápido.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 grid-flow-dense auto-rows-[180px]">
            <div className="col-span-2 row-span-1 rounded-2xl border border-[#905BF4]/15 bg-[#12121A] p-6 flex flex-col justify-between hover:border-[#905BF4]/30 hover:scale-[1.01] transition-all duration-300">
              <div className="flex items-start gap-4">
                <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#905BF4] to-[#B470FF] flex items-center justify-center shrink-0">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-lg mb-1" style={{ fontFamily: "var(--font-dm-sans)" }}>
                    Matching inteligente
                  </h3>
                  <p className="text-white/50 text-sm leading-relaxed">
                    Algoritmo que conecta tu stack y disponibilidad con proyectos reales. Sin postulaciones en frío.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-4 flex-wrap">
                {["React", "Node.js", "Diseño UX", "Marketing"].map((skill) => (
                  <span key={skill} className="px-3 py-1 rounded-full bg-[#905BF4]/15 text-[#B470FF] text-xs font-medium">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div className="col-span-1 row-span-2 rounded-2xl border border-[#905BF4]/15 bg-[#12121A] p-6 flex flex-col hover:border-[#905BF4]/30 hover:scale-[1.01] transition-all duration-300">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#905BF4] flex items-center justify-center mb-4">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-semibold text-white text-lg mb-2" style={{ fontFamily: "var(--font-dm-sans)" }}>
                Chat sin fricción
              </h3>
              <p className="text-white/50 text-sm leading-relaxed flex-1">
                Mensajería anti-leakage. Propuestas ricas, notas de voz y milestones — todo dentro de la plataforma.
              </p>
              <div className="mt-6 space-y-2">
                {["Sin fugas de contacto", "Proposal cards", "Voice notes"].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-xs text-white/40">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#905BF4]" />
                    {f}
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-1 row-span-1 rounded-2xl border border-[#905BF4]/15 bg-[#12121A] p-6 hover:border-[#905BF4]/30 hover:scale-[1.02] transition-all duration-300">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#B470FF] to-[#905BF4] flex items-center justify-center mb-3">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-semibold text-white text-base mb-1" style={{ fontFamily: "var(--font-dm-sans)" }}>Contratos in-app</h3>
              <p className="text-white/50 text-xs leading-relaxed">Generá acuerdos, firma digital y milestones sin salir de la plataforma.</p>
            </div>

            <div className="col-span-1 row-span-1 rounded-2xl border border-[#905BF4]/15 bg-[#12121A] p-6 hover:border-[#905BF4]/30 hover:scale-[1.02] transition-all duration-300">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#905BF4] to-[#6D28D9] flex items-center justify-center mb-3">
                <Trophy className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-semibold text-white text-base mb-1" style={{ fontFamily: "var(--font-dm-sans)" }}>Score de reputación</h3>
              <p className="text-white/50 text-xs leading-relaxed">XP, badges y niveles que visibilizan tu talento desde el día 1.</p>
            </div>
          </div>
        </div>
      </section>

      {/* DESIRE — How it works */}
      <section className="px-4 py-24 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
          style={{ backgroundImage: "radial-gradient(circle 600px at 80% 50%, rgba(144,91,244,0.1), transparent)" }} />
        <div className="mx-auto max-w-5xl relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-white mb-4" style={{ fontFamily: "var(--font-dm-sans)" }}>
              Cómo funciona
            </h2>
            <p className="text-white/50">En menos de 3 minutos, listo para tu primer match.</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.number} className="relative">
                  {i < steps.length - 1 && (
                    <div className="absolute left-full top-8 hidden md:block w-full border-t border-dashed border-[#905BF4]/20 -translate-x-4" />
                  )}
                  <div className="flex flex-col items-center text-center md:items-start md:text-left">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#905BF4] to-[#B470FF] flex items-center justify-center mb-4"
                      style={{ boxShadow: "0 0 20px rgba(144,91,244,0.3)" }}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="text-xs text-[#905BF4] font-bold mb-1 font-mono">{step.number}</div>
                    <h3 className="text-xl font-semibold text-white mb-2" style={{ fontFamily: "var(--font-dm-sans)" }}>{step.title}</h3>
                    <p className="text-sm text-white/50 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-white mb-4" style={{ fontFamily: "var(--font-dm-sans)" }}>
              Lo que dicen quienes ya usan Freelie
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <div key={t.name} className="rounded-2xl border border-[#905BF4]/15 bg-[#12121A] p-6 hover:border-[#905BF4]/30 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.avatar} alt={t.name} width={40} height={40} className="h-10 w-10 rounded-full object-cover" />
                  <div>
                    <div className="text-sm font-semibold text-white">{t.name}</div>
                    <div className="text-xs text-white/40">{t.role}</div>
                  </div>
                  <div className="ml-auto px-2 py-0.5 rounded-full bg-[#905BF4]/15 text-[#B470FF] text-xs">{t.xp}</div>
                </div>
                <div className="flex mb-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 text-[#905BF4] fill-[#905BF4]" />
                  ))}
                </div>
                <p className="text-sm text-white/60 leading-relaxed">&quot;{t.quote}&quot;</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ACTION — Pricing */}
      <section id="pricing" className="px-4 py-24 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true"
          style={{ backgroundImage: "radial-gradient(circle 500px at 20% 50%, rgba(144,91,244,0.08), transparent)" }} />
        <div className="mx-auto max-w-5xl relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-white mb-4" style={{ fontFamily: "var(--font-dm-sans)" }}>
              Planes que escalan con vos
            </h2>
            <p className="text-white/50 max-w-xl mx-auto">
              La comisión del 1% se aplica en todos los planes. Las suscripciones son para matching y visibilidad.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {pricingTiers.map((tier) => (
              <div key={tier.name} className={`rounded-2xl p-6 border transition-all hover:scale-[1.01] flex flex-col ${
                tier.highlighted
                  ? "border-[#905BF4] bg-gradient-to-b from-[#905BF4]/15 to-[#12121A]"
                  : "border-[#905BF4]/15 bg-[#12121A] hover:border-[#905BF4]/30"
              }`}
                style={tier.highlighted ? { boxShadow: "0 0 40px rgba(144,91,244,0.2)" } : {}}>
                {tier.highlighted && (
                  <div className="text-xs font-bold text-[#905BF4] uppercase tracking-widest mb-3">Más popular</div>
                )}
                <div className="mb-4">
                  <div className="text-xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-dm-sans)" }}>{tier.name}</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-white">${tier.price}</span>
                    {tier.price !== "0" && <span className="text-white/40 text-sm">/mes</span>}
                  </div>
                  <p className="text-white/40 text-sm mt-1">{tier.description}</p>
                </div>
                <ul className="space-y-3 flex-1 mb-6">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-white/70">
                      <CheckCircle className="h-4 w-4 text-[#905BF4] shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={tier.href}
                  className={`w-full h-11 rounded-xl font-semibold flex items-center justify-center transition-colors min-h-[44px] ${
                    tier.highlighted
                      ? "bg-[#905BF4] hover:bg-[#7C3AED] text-white"
                      : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
                  }`}
                  style={tier.highlighted ? { boxShadow: "0 0 20px rgba(144,91,244,0.3)" } : {}}
                >
                  {tier.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-white/30 mt-6">1% de comisión sobre contratos cerrados. Sin costos ocultos.</p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="rounded-3xl border border-[#905BF4]/20 p-12"
            style={{
              background: "linear-gradient(180deg, rgba(144,91,244,0.1) 0%, #12121A 100%)",
              boxShadow: "0 0 80px rgba(144,91,244,0.15)",
            }}>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-white mb-4" style={{ fontFamily: "var(--font-dm-sans)" }}>
              Empezá gratis.{" "}
              <span style={{ background: "linear-gradient(135deg, #905BF4, #B470FF)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                Crecé en serio.
              </span>
            </h2>
            <p className="text-white/50 mb-8 max-w-lg mx-auto">
              Únite hoy. El registro es gratis, el primer match tarda minutos y la comisión más baja del mercado te espera.
            </p>
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 bg-[#905BF4] hover:bg-[#7C3AED] text-white h-14 px-10 rounded-2xl font-semibold transition-all min-h-[44px]"
              style={{ boxShadow: "0 0 40px rgba(144,91,244,0.4)" }}
            >
              Crear cuenta gratis <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-4 py-12 sm:px-6 lg:px-8" style={{ borderColor: "rgba(144,91,244,0.1)" }}>
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-center gap-6 md:flex-row md:justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#905BF4] to-[#B470FF] flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-lg font-bold text-white" style={{ fontFamily: "var(--font-dm-sans)" }}>Freelie</span>
            </Link>
            <p className="text-sm text-white/30">Freelie © 2026 — Conectando talento con oportunidades reales.</p>
            <div className="flex gap-6 text-sm text-white/40">
              <Link href="#" className="hover:text-white transition-colors">Términos</Link>
              <Link href="#" className="hover:text-white transition-colors">Privacidad</Link>
              <Link href="#" className="hover:text-white transition-colors">Contacto</Link>
              <Link href="#" className="hover:text-white transition-colors">Instagram</Link>
              <Link href="#" className="hover:text-white transition-colors">LinkedIn</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
