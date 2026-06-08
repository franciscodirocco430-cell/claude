import type { Metadata } from "next";
import { Inter, Syne } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Freelie — Find Talent. Ship Faster.",
    template: "%s | Freelie",
  },
  description:
    "Freelie is a SaaS-enabled marketplace connecting top digital talent with ambitious clients. Anti-leakage chat, escrow-backed contracts, XP-driven profiles.",
  keywords: ["freelance", "marketplace", "talent", "contracts", "remote work"],
  openGraph: {
    title: "Freelie — Find Talent. Ship Faster.",
    description:
      "Connect with top digital talent. Escrow contracts, milestone tracking, and anti-leakage messaging.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${syne.variable}`}
    >
      <body className="min-h-screen bg-white dark:bg-gray-950">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
