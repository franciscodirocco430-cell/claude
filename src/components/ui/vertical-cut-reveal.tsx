"use client";

import React from "react";
import { motion } from "framer-motion";

interface VerticalCutRevealProps {
  children: string;
  className?: string;
  delay?: number;
  duration?: number;
  splitBy?: "words" | "characters";
}

export function VerticalCutReveal({
  children,
  className,
  delay = 0,
  duration = 0.5,
  splitBy = "words",
}: VerticalCutRevealProps) {
  const parts = splitBy === "words" ? children.split(" ") : children.split("");

  return (
    <span className={className} style={{ display: "inline-flex", flexWrap: "wrap", gap: splitBy === "words" ? "0.25em" : "0" }}>
      {parts.map((part, i) => (
        <span key={i} style={{ overflow: "hidden", display: "inline-block" }}>
          <motion.span
            style={{ display: "inline-block" }}
            initial={{ y: "100%" }}
            animate={{ y: "0%" }}
            transition={{
              duration,
              delay: delay + i * 0.05,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          >
            {part}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
