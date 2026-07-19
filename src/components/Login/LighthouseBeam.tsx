'use client';
import React, { useEffect, useRef } from 'react';
import styles from './LighthouseBeam.module.css';

interface Props {
  isHovered: boolean;
}

const SWEEP_DURATION_MS = 9000; // one full 360° rotation

export default function LighthouseBeam({ isHovered }: Props) {
  const beamRef = useRef<HTMLDivElement>(null);
  // Track the raw accumulated rotation in degrees (can exceed 360)
  const currentAngleRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  // When we paused, what was the CSS-animation progress (0–1)?
  const pausedProgressRef = useRef(0);
  const lastTimestampRef = useRef<number | null>(null);
  const isFocusedRef = useRef(false);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const setRotation = (deg: number) => {
    if (!beamRef.current) return;
    beamRef.current.style.transform = `rotate(${deg}deg)`;
  };

  /** Read the actual current rotation from the live CSS animation */
  const readCSSAnimationAngle = (): number => {
    const el = beamRef.current;
    if (!el) return currentAngleRef.current;
    const anim = el.getAnimations().find(a => (a as CSSAnimation).animationName === 'beam-sweep');
    if (!anim) return currentAngleRef.current;
    const timing = anim.effect?.getComputedTiming();
    const progress = (timing?.progress ?? 0) as number;
    return progress * 360;
  };

  // ── RAF tween: smoothly rotate toward `targetAngle` ──────────────────────
  const tweenToAngle = (targetAngle: number, onDone?: () => void) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const startAngle = currentAngleRef.current;
    // Always pick the shortest arc
    let delta = ((targetAngle - startAngle) % 360 + 540) % 360 - 180;
    const endAngle = startAngle + delta;
    const duration = Math.max(500, Math.abs(delta) / 360 * 1200); // proportional, min 500ms
    let startTime: number | null = null;

    const ease = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // ease-in-out

    const frame = (ts: number) => {
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;
      const t = Math.min(elapsed / duration, 1);
      const angle = startAngle + delta * ease(t);
      currentAngleRef.current = angle;
      setRotation(angle);

      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        currentAngleRef.current = endAngle;
        rafRef.current = null;
        onDone?.();
      }
    };

    rafRef.current = requestAnimationFrame(frame);
  };

  // ── Continuous sweep using rAF (no CSS animation — avoids reset) ──────────
  const startSweep = (fromAngle: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    let lastTs: number | null = null;
    currentAngleRef.current = fromAngle;

    const frame = (ts: number) => {
      if (isFocusedRef.current) return; // stop if focused
      if (lastTs === null) lastTs = ts;
      const dt = ts - lastTs;
      lastTs = ts;
      currentAngleRef.current += (360 / SWEEP_DURATION_MS) * dt;
      setRotation(currentAngleRef.current);
      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
  };

  // ── Effect ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setRotation(0);
      return;
    }

    if (isHovered) {
      // Stop sweep
      isFocusedRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;

      // Tween to 0° (straight ahead, pointing at card)
      tweenToAngle(0);
    } else {
      // Resume sweep from wherever the beam currently is
      isFocusedRef.current = false;
      const fromAngle = currentAngleRef.current;

      // Wait for any in-progress tween to settle then start sweep
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      startSweep(fromAngle);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHovered]);

  // Kick off sweep on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    isFocusedRef.current = false;
    startSweep(0);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.beamWrapper}>
      <div ref={beamRef} className={styles.lightBeam} />
    </div>
  );
}
