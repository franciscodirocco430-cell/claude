import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#4C7CFF",
          50: "#EEF3FF",
          100: "#DCE6FF",
          200: "#B9CEFF",
          300: "#96B5FF",
          400: "#739DFF",
          500: "#4C7CFF",
          600: "#2E5EF0",
          700: "#1F46C4",
          800: "#183798",
          900: "#12296E",
        },
        secondary: {
          DEFAULT: "#8B5CF6",
          50: "#F3EEFE",
          100: "#E7DDFD",
          200: "#CFBBFB",
          300: "#B799F9",
          400: "#9F77F7",
          500: "#8B5CF6",
          600: "#7439F2",
          700: "#5E1EEB",
          800: "#4A17BC",
          900: "#37118D",
        },
        surface: {
          DEFAULT: "#0D0D0D",
          card: "#121212",
          "card-hover": "#151515",
          raised: "#181818",
        },
        border: "var(--border)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        score: {
          excellent: "#34D399",
          good: "#4C7CFF",
          fair: "#FBBF24",
          poor: "#F87171",
        },
      },
      fontFamily: {
        display: ["var(--font-syne)", "sans-serif"],
        sans: ["var(--font-inter)", "sans-serif"],
      },
      borderRadius: {
        card: "20px",
        "card-lg": "24px",
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        shimmer: "shimmer 2s linear infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
