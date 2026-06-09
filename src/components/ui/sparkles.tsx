"use client";

import React, { useEffect, useId, useRef, useState } from "react";

interface SparklesProps {
  className?: string;
  background?: string;
  particleColor?: string;
  particleDensity?: number;
  speed?: number;
  minSize?: number;
  maxSize?: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  opacityDir: number;
}

export function SparklesCore({
  className,
  background = "transparent",
  particleColor = "#905BF4",
  particleDensity = 80,
  speed = 0.5,
  minSize = 0.6,
  maxSize = 1.4,
}: SparklesProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      particlesRef.current = Array.from({ length: particleDensity }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 0.5) * speed,
        size: minSize + Math.random() * (maxSize - minSize),
        opacity: Math.random(),
        opacityDir: Math.random() > 0.5 ? 1 : -1,
      }));
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.opacity += p.opacityDir * 0.005;
        if (p.opacity > 0.8) { p.opacity = 0.8; p.opacityDir = -1; }
        if (p.opacity < 0.1) { p.opacity = 0.1; p.opacityDir = 1; }
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = particleColor;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      rafRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [particleColor, particleDensity, speed, minSize, maxSize]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ background, display: "block", width: "100%", height: "100%" }}
    />
  );
}
