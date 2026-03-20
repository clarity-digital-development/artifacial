"use client";

import { useState, useEffect } from "react";

type Particle = {
  id: number;
  x: number;
  startY: number;
  size: number;
  duration: number;
  delay: number;
  drift: number;
  opacity: number;
};

function generateParticles(): Particle[] {
  const left = Array.from({ length: 14 }, (_, i) => {
    const t = Math.random();
    return {
      id: i,
      x: 3 + t * 30 + (Math.random() - 0.5) * 10,
      startY: 2 + t * 45 + (Math.random() - 0.5) * 8,
      size: 1 + Math.random() * 1.5,
      duration: 7 + Math.random() * 7,
      delay: Math.random() * 12,
      drift: 2 + Math.random() * 5,
      opacity: 0.2 + Math.random() * 0.3 * (1 - t * 0.4),
    };
  });

  const right = Array.from({ length: 14 }, (_, i) => {
    const t = Math.random();
    return {
      id: i + 20,
      x: 97 - 3 - t * 30 + (Math.random() - 0.5) * 10,
      startY: 2 + t * 45 + (Math.random() - 0.5) * 8,
      size: 1 + Math.random() * 1.5,
      duration: 7 + Math.random() * 7,
      delay: Math.random() * 12,
      drift: -2 - Math.random() * 5,
      opacity: 0.2 + Math.random() * 0.3 * (1 - t * 0.4),
    };
  });

  return [...left, ...right];
}

export function StudioLights() {
  return null;
}

export function StudioLightParticles() {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    setParticles(generateParticles());
  }, []);

  if (particles.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[3] overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-[var(--accent-amber)]"
          style={{
            left: `${p.x}%`,
            top: `${p.startY}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: 0,
            animation: `dust-float ${p.duration}s ${p.delay}s ease-in-out infinite`,
            ["--dust-drift" as string]: `${p.drift}px`,
            ["--dust-opacity" as string]: p.opacity,
          }}
        />
      ))}
    </div>
  );
}
