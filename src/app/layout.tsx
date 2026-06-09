import type { Metadata } from "next";
import { Exo_2, Nunito } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/ui/toaster";
import "./globals.css";

// Closest to Cropar Regular: geometric tech uppercase display font
const exo2 = Exo_2({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

// Closest to Futura: geometric humanist sans with multiple weights
const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Freelie — Conectando talento con oportunidades reales",
    template: "%s | Freelie",
  },
  description:
    "Freelie es el primer marketplace LATAM para talento digital joven y PYMEs. 1% de comisión, contratos in-app, chat anti-leakage y sistema de reputación gamificado.",
  keywords: ["freelance", "marketplace", "talento", "PYME", "LATAM", "trabajo digital", "contratos", "XP"],
  openGraph: {
    title: "Freelie — Tu próximo trabajo no pide CV. Pide talento.",
    description:
      "Conectamos jóvenes profesionales con PYMEs que necesitan talento real, ahora. 1% de comisión, chat anti-leakage y gamificación real.",
    type: "website",
    locale: "es_AR",
    siteName: "Freelie",
  },
  twitter: {
    card: "summary_large_image",
    title: "Freelie — Tu próximo trabajo no pide CV. Pide talento.",
    description: "Marketplace para talento digital LATAM. 1% de comisión, contratos in-app, XP gamificado.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${exo2.variable} ${nunito.variable} dark`}
    >
      <body className="min-h-screen bg-[#0A0A0F] text-white">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
