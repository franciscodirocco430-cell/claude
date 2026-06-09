"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Moon, Sun, LogOut, Settings, User, ChevronDown } from "lucide-react";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/lib/types/database.types";

interface NavbarProps {
  profile: Profile | null;
}

export function Navbar({ profile }: NavbarProps) {
  const { theme, setTheme } = useTheme();
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
          { href: "/contracts", label: "Contracts" },
        ]
      : [
          { href: "/feed", label: "Talent" },
          { href: "/projects", label: "Projects" },
          { href: "/matches", label: "Applications" },
          { href: "/chat", label: "Chat" },
          { href: "/contracts", label: "Contracts" },
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
        <Link href="/feed" className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#905BF4] to-[#B470FF] flex items-center justify-center"
            style={{ boxShadow: "0 0 12px rgba(144,91,244,0.4)" }}>
            <span className="text-sm font-bold text-white">F</span>
          </div>
          <span className="text-xl font-bold text-white" style={{ fontFamily: "var(--font-dm-sans)" }}>
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
              className="bg-[#905BF4] hover:bg-[#7C3AED] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors min-h-[44px] flex items-center">
              Iniciar sesión
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
