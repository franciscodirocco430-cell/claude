import React from "react";

interface RadialGlowBackgroundProps {
  children: React.ReactNode;
  className?: string;
  glowPosition?: string;
}

export default function RadialGlowBackground({
  children,
  className = "",
  glowPosition = "50% 100px",
}: RadialGlowBackgroundProps) {
  return (
    <div className={`min-h-screen w-full bg-[#0A0A0F] relative ${className}`}>
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle 500px at ${glowPosition}, rgba(144, 91, 246, 0.35), transparent)`,
        }}
        aria-hidden="true"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
