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
          DEFAULT: "#905BF4",
          50: "#F3EEFE",
          100: "#E7DDFD",
          200: "#CFBBFB",
          300: "#B799F9",
          400: "#9F77F7",
          500: "#905BF4",
          600: "#7A3FF2",
          700: "#6423F0",
          800: "#5119C5",
          900: "#3D139A",
        },
        secondary: {
          DEFAULT: "#B470FF",
          50: "#F5EBFF",
          100: "#EBD7FF",
          200: "#D7AFFF",
          300: "#C387FF",
          400: "#B470FF",
          500: "#A558FF",
          600: "#8C33FF",
          700: "#730EFF",
          800: "#5F00E9",
          900: "#4C00BA",
        },
        border: "var(--border)",
        background: "var(--background)",
        foreground: "var(--foreground)",
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
      },
      fontFamily: {
        display: ["var(--font-dm-sans)", "var(--font-outfit)", "sans-serif"],
        sans: ["var(--font-outfit)", "var(--font-dm-sans)", "sans-serif"],
      },
      animation: {
        "fade-in": "fadeIn 0.2s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
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
      },
    },
  },
  plugins: [],
};

export default config;
