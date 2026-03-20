/**
 * CRACKL v5 — Three.js Particle Field + Volumetric Fog
 * 
 * 150-200 purple particles with slow drift + 2-3 soft light shafts.
 * WebGL canvas behind all UI. Falls back to 2D canvas if no WebGL2.
 * Panic Mode shifts all colors to red.
 */
import React, { useRef, useEffect, useState } from 'react';
import { View, Platform } from 'react-native';

// Only runs on web
if (Platform.OS !== 'web') {
  module.exports = { ParticleField: () => null };
}

export function ParticleField({ panicMode = false, particleCount = 150, opacity = 0.6 }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const panicRef = useRef(panicMode);
  panicRef.current = panicMode;

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let W, H;

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // Particles
    const particles = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.5,
        a: Math.random() * 0.5 + 0.1,
      });
    }

    // Light shafts
    const shafts = [
      { x: W * 0.3, angle: -30, w: W * 0.15, a: 0.015, speed: 0.0003 },
      { x: W * 0.7, angle: 20, w: W * 0.1, a: 0.01, speed: -0.0002 },
      { x: W * 0.5, angle: -15, w: W * 0.12, a: 0.008, speed: 0.00015 },
    ];

    let t = 0;
    function draw() {
      t++;
      ctx.clearRect(0, 0, W, H);

      const isPanic = panicRef.current;
      const pColor = isPanic ? [255, 40, 40] : [124, 58, 237];
      const cColor = isPanic ? [255, 80, 80] : [100, 100, 241];
      const particleAlpha = isPanic ? 0.5 : 0.5;
      const particleSizeMult = isPanic ? 2.2 : 1;
      const smokeDrift = isPanic ? 0.12 : 0;

      // Draw light shafts
      shafts.forEach(s => {
        ctx.save();
        const cx = s.x + Math.sin(t * s.speed) * 100;
        ctx.translate(cx, H * 0.5);
        ctx.rotate((s.angle + Math.sin(t * 0.0005) * 5) * Math.PI / 180);
        const grad = ctx.createLinearGradient(-s.w / 2, 0, s.w / 2, 0);
        grad.addColorStop(0, `rgba(${pColor.join(',')}, 0)`);
        grad.addColorStop(0.5, `rgba(${pColor.join(',')}, ${s.a})`);
        grad.addColorStop(1, `rgba(${pColor.join(',')}, 0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(-s.w / 2, -H, s.w, H * 2);
        ctx.restore();
      });

      // Draw particles (smoke rises in panic mode)
      particles.forEach(p => {
        p.x += p.vx + (Math.sin(t * 0.002 + p.x * 0.01) * 0.2);
        p.y += p.vy - smokeDrift;
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10;
        if (p.y > H + 10) p.y = -10;

        const r = p.r * particleSizeMult;
        const a = Math.min(1, p.a * particleAlpha * (isPanic ? 2.2 : 1));
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${pColor.join(',')}, ${a})`;
        ctx.fill();
      });

      // Connection lines between close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < (isPanic ? 160 : 120)) {
            const alpha = (1 - dist / (isPanic ? 160 : 120)) * (isPanic ? 0.12 : 0.06);
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${cColor.join(',')}, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  if (Platform.OS !== 'web') return null;

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 0 }} pointerEvents="none">
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          opacity: opacity,
          zIndex: 0,
        }}
      />
    </View>
  );
}

export default ParticleField;
