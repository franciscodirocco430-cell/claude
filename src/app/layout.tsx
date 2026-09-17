import type { Metadata } from "next";
import { Inter, Syne } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { ToastProvider } from "@/components/ui/toaster";
import { SiteHeader } from "@/components/layout/site-header";
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
    default: "Content Intelligence — AI content analysis",
    template: "%s | Content Intelligence",
  },
  description:
    "Upload social and marketing content and get AI-driven scores, honest insights, and concrete recommendations for your next piece.",
  keywords: [
    "content analysis",
    "AI marketing",
    "social media analytics",
    "content strategy",
  ],
  openGraph: {
    title: "Content Intelligence",
    description:
      "AI-powered content analysis: scores, hook analysis, retention, recommendations, and next content ideas.",
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
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} ${syne.variable} dark`}
    >
      <body className="min-h-screen bg-background text-foreground">
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="dark"
          forcedTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <ToastProvider>
            <SiteHeader />
            {children}
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
