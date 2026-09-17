"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export interface LiquidButtonProps
  extends Omit<HTMLMotionProps<"button">, "ref" | "children"> {
  loading?: boolean;
  icon?: React.ReactNode;
  size?: "default" | "lg" | "xl";
  children?: React.ReactNode;
}

const sizeClasses: Record<NonNullable<LiquidButtonProps["size"]>, string> = {
  default: "h-11 px-6 text-sm",
  lg: "h-13 px-8 text-base",
  xl: "h-14 px-10 text-base",
};

/**
 * Premium "liquid glass" CTA button. Used sparingly for primary actions
 * (Analyze Content, Upload Content, Generate Recommendations, Create Next
 * Content) — not for every button in the app.
 */
export const LiquidButton = React.forwardRef<HTMLButtonElement, LiquidButtonProps>(
  ({ className, children, loading, icon, size = "default", disabled, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        disabled={disabled || loading}
        whileHover={{ scale: disabled || loading ? 1 : 1.015 }}
        whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={cn(
          "group relative isolate inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl font-medium text-white",
          "shadow-[0_8px_30px_rgba(76,124,255,0.35)]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {/* base gradient */}
        <span
          aria-hidden
          className="absolute inset-0 -z-20 bg-gradient-to-br from-primary via-primary-600 to-secondary"
        />
        {/* liquid glass sheen */}
        <span
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-br from-white/25 via-white/5 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-100"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-y-4 -left-1/3 w-1/3 -skew-x-12 bg-white/20 blur-md transition-transform duration-700 ease-out group-hover:translate-x-[260%]"
        />
        <span
          aria-hidden
          className="absolute inset-0 -z-10 rounded-2xl border border-white/30"
        />

        {loading ? (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          icon
        )}
        <span className="relative">{children}</span>
      </motion.button>
    );
  }
);
LiquidButton.displayName = "LiquidButton";
