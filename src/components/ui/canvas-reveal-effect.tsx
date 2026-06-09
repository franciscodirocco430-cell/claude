"use client";

import React, { useEffect, useRef } from "react";

interface CanvasRevealEffectProps {
  color1?: string;
  color2?: string;
  className?: string;
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

export function CanvasRevealEffect({
  color1 = "#905BF4",
  color2 = "#B470FF",
  className,
}: CanvasRevealEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const GRID = 36;
    const [r1, g1, b1] = hexToRgb(color1);
    const [r2, g2, b2] = hexToRgb(color2);

    const rand = (x: number, y: number, t: number) => {
      const s = Math.sin(x * 127.1 + y * 311.7 + t * 0.5) * 43758.5453;
      return s - Math.floor(s);
    };

    const draw = (ts: number) => {
      timeRef.current = ts / 1000;
      const t = timeRef.current;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cellW = canvas.width / GRID;
      const cellH = canvas.height / GRID;
      const dotR = Math.min(cellW, cellH) * 0.28;

      for (let x = 0; x < GRID; x++) {
        for (let y = 0; y < GRID; y++) {
          const r = rand(x, y, Math.floor(t * 1.5));
          const pulse = rand(x, y, Math.floor(t * 0.8) + 100);
          if (r < 0.15 || pulse < 0.08) {
            const alpha = r < 0.15 ? 0.6 + r * 2 : 0.3 + pulse;
            const mix = (x / GRID + y / GRID) * 0.5;
            const cr = r1 + (r2 - r1) * mix;
            const cg = g1 + (g2 - g1) * mix;
            const cb = b1 + (b2 - b1) * mix;
            ctx.beginPath();
            ctx.arc(
              x * cellW + cellW / 2,
              y * cellH + cellH / 2,
              dotR,
              0,
              Math.PI * 2
            );
            ctx.fillStyle = `rgba(${Math.round(cr * 255)},${Math.round(cg * 255)},${Math.round(cb * 255)},${Math.min(alpha, 0.9)})`;
            ctx.fill();
          }
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [color1, color2]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block", width: "100%", height: "100%", background: "transparent" }}
    />
  );
}
