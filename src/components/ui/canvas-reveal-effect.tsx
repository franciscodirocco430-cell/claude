"use client";

import React, { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const fragmentShader = `
precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec3 u_color1;
uniform vec3 u_color2;

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;

  float gridSize = 40.0;
  vec2 grid = floor(uv * gridSize) / gridSize;
  vec2 cell = fract(uv * gridSize);

  float r = random(grid + floor(u_time * 0.5));
  float pulse = random(grid + floor(u_time * 1.3));

  float dot = smoothstep(0.4, 0.35, length(cell - 0.5));

  float brightness = mix(0.0, 1.0, step(0.85, r)) * dot;
  brightness += mix(0.0, 0.5, step(0.92, pulse)) * dot;

  vec3 col = mix(u_color1, u_color2, uv.x + uv.y * 0.5);
  gl_FragColor = vec4(col * brightness, brightness * 0.9);
}
`;

const vertexShader = `
void main() {
  gl_Position = vec4(position, 1.0);
}
`;

function DotMatrixMesh({ color1, color2 }: { color1: string; color2: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { size } = useThree();

  const uniforms = useMemo(
    () => ({
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2(size.width, size.height) },
      u_color1: { value: new THREE.Color(color1) },
      u_color2: { value: new THREE.Color(color2) },
    }),
    [color1, color2, size.width, size.height]
  );

  useFrame(({ clock }) => {
    if (meshRef.current) {
      (meshRef.current.material as THREE.ShaderMaterial).uniforms.u_time.value = clock.getElapsedTime();
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        fragmentShader={fragmentShader}
        vertexShader={vertexShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

interface CanvasRevealEffectProps {
  color1?: string;
  color2?: string;
  className?: string;
}

export function CanvasRevealEffect({
  color1 = "#905BF4",
  color2 = "#B470FF",
  className,
}: CanvasRevealEffectProps) {
  return (
    <div className={className}>
      <Canvas
        gl={{ antialias: false, alpha: true }}
        camera={{ position: [0, 0, 1] }}
        style={{ background: "transparent" }}
      >
        <DotMatrixMesh color1={color1} color2={color2} />
      </Canvas>
    </div>
  );
}
