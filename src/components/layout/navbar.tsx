"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Settings, User, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { Profile } from "@/lib/types/database.types";

interface NavbarProps {
  profile: Profile | null;
}

function FreelieVortex({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="nav-vortex" cx="40%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#C084FC" />
          <stop offset="100%" stopColor="#7C3AED" />
        </radialGradient>
      </defs>
      <path d="M50 50 C50 28 32 16 18 20 C14 34 26 52 50 50Z" fill="url(#nav-vortex)" opacity="0.95" />
      <path d="M50 50 C72 50 84 32 80 18 C66 14 48 26 50 50Z" fill="url(#nav-vortex)" opacity="0.8" />
      <path d="M50 50 C72 50 84 68 80 82 C66 86 48 74 50 50Z" fill="url(#nav-vortex)" opacity="0.7" />
      <path d="M50 50 C50 72 32 84 18 80 C14 66 26 48 50 50Z" fill="url(#nav-vortex)" opacity="0.9" />
      <path d="M50 50 C28 50 16 68 20 82 C34 86 52 74 50 50Z" fill="url(#nav-vortex)" opacity="0.6" />
      <circle cx="50" cy="50" r="10" fill="#0A0A0F" opacity="0.8" />
    </svg>
  );
}

export function Navbar({ profile }: NavbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const navLinks =
    profile?.role === "freelo"
      ? [
          { href: "/feed", label: "Feed" },
          { href: "/matches", label: "Matches" },
          { href: "/chat", label: "Chat" },
          { href: "/contracts", label: "Contratos" },
        ]
      : [
          { href: "/feed", label: "Talento" },
          { href: "/projects", label: "Proyectos" },
          { href: "/matches", label: "Aplicaciones" },
          { href: "/chat", label: "Chat" },
          { href: "/contracts", label: "Contratos" },
        ];

  return (
    <header className="sticky top-0 z-40 border-b"
      style={{
        borderColor: "rgba(144,91,244,0.12)",
        background: "rgba(10,10,15,0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/feed" className="flex items-center gap-2">
          <FreelieVortex size={30} />
          <span className="text-lg font-bold tracking-widest text-white uppercase" style={{ fontFamily: "var(--font-display)" }}>
            Freelie
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl px-3 py-2 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {profile ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 rounded-xl p-1.5 transition-colors hover:bg-white/5 min-h-[44px]"
              >
                <Avatar size="sm">
                  <AvatarImage src={profile.avatar_url} alt={profile.display_name ?? ""} size="sm" />
                  <AvatarFallback name={profile.display_name} />
                </Avatar>
                <span className="hidden text-sm font-medium text-white/80 sm:block">
                  {profile.display_name ?? profile.email}
                </span>
                <ChevronDown className="h-3 w-3 text-white/40" />
              </button>

              {dropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-52 rounded-2xl py-2 shadow-xl"
                    style={{
                      background: "#12121A",
                      border: "1px solid rgba(144,91,244,0.2)",
                      boxShadow: "0 0 40px rgba(0,0,0,0.5)",
                    }}>
                    <div className="px-4 pb-3 border-b" style={{ borderColor: "rgba(144,91,244,0.12)" }}>
                      <p className="text-sm font-medium text-white">{profile.display_name ?? "Usuario"}</p>
                      <p className="text-xs text-white/40 truncate">{profile.email}</p>
                    </div>
                    <Link href={`/profile/${profile.id}`} onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors">
                      <User className="h-4 w-4" /> Ver perfil
                    </Link>
                    <Link href="/settings" onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors">
                      <Settings className="h-4 w-4" /> Configuración
                    </Link>
                    <button onClick={handleSignOut}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                      <LogOut className="h-4 w-4" /> Cerrar sesión
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link href="/auth"
              className="text-white text-sm font-semibold px-5 py-2 rounded-xl transition-all min-h-[44px] flex items-center tracking-wide uppercase"
              style={{
                background: "linear-gradient(90deg, #905BF4, #B470FF)",
                fontFamily: "var(--font-display)",
                boxShadow: "0 0 20px rgba(144,91,244,0.3)",
              }}>
              Ingresar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
