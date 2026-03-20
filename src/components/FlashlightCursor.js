/**
 * CRACKL v5 — Flashlight Cursor
 * 
 * Radial gradient follows mouse with GSAP-like smooth lag.
 * Purple glow → red in Panic Mode.
 * Disabled on touch devices.
 */
import React, { useRef, useEffect, useState } from 'react';
import { Platform } from 'react-native';

export function FlashlightCursor({ panicMode = false }) {
  const elRef = useRef(null);
  const pos = useRef({ x: -300, y: -300 });
  const target = useRef({ x: -300, y: -300 });
  const rafRef = useRef(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Check for hover capability (no touch-only devices)
    if (!window.matchMedia('(hover: hover)').matches) return;

    const el = elRef.current;
    if (!el) return;

    function onMouse(e) {
      target.current = { x: e.clientX, y: e.clientY };
    }
    window.addEventListener('mousemove', onMouse);

    function animate() {
      // Smooth lag (lerp)
      pos.current.x += (target.current.x - pos.current.x) * 0.12;
      pos.current.y += (target.current.y - pos.current.y) * 0.12;
      el.style.left = pos.current.x + 'px';
      el.style.top = pos.current.y + 'px';
      rafRef.current = requestAnimationFrame(animate);
    }
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', onMouse);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (Platform.OS !== 'web') return null;

  return (
    <div
      ref={elRef}
      className={`flashlight${panicMode ? ' panic' : ''}`}
      style={{ position: 'fixed', top: -300, left: -300 }}
    />
  );
}

export default FlashlightCursor;
