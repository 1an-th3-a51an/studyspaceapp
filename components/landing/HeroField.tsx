"use client";

import { useEffect, useRef } from "react";

const HOURS = ["8:00", "9:30", "11:00", "1:00", "2:30", "4:00", "5:30", "7:00"];

export function HeroField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const jitter: number[] = [];

    let width = 0;
    let height = 0;
    let mx = -2400;
    let my = -2400;
    let tx = -2400;
    let ty = -2400;
    let frame = 0;
    let last = performance.now();

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const rows = Math.max(18, Math.round(height / 38));
      jitter.length = rows;
      for (let i = 0; i < rows; i += 1) {
        jitter[i] = ((i * 37) % 11) * 0.18 - 1;
      }
    };

    const onMove = (event: PointerEvent) => {
      tx = event.clientX;
      ty = event.clientY;
    };

    const onLeave = () => {
      tx = -2400;
      ty = -2400;
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      const rows = jitter.length;
      const gutter = Math.min(92, Math.max(64, width * 0.1));
      const radius = Math.max(120, Math.min(width, height) * 0.28);
      const ink = "40, 28, 18";

      ctx.strokeStyle = "rgba(154, 52, 32, 0.16)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let s = 0; s <= 36; s += 1) {
        const y = (s / 36) * height;
        const dist = Math.hypot(gutter - mx, y - my);
        const fall = Math.exp(-(dist * dist) / (2 * radius * radius));
        const x = gutter + (gutter - mx) * fall * 0.12;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      for (let i = 0; i < rows; i += 1) {
        const y0 = ((i + 0.55) / rows) * height + jitter[i];
        const heavy = i % 5 === 0;
        ctx.beginPath();
        ctx.lineWidth = heavy ? 1.1 : 0.65;
        ctx.strokeStyle = `rgba(${ink}, ${heavy ? 0.2 : 0.09})`;
        const steps = 40;
        for (let s = 0; s <= steps; s += 1) {
          const x = (s / steps) * width;
          const dist = Math.hypot(x - mx, y0 - my);
          const fall = Math.exp(-(dist * dist) / (2 * radius * radius));
          const px = x + (x - mx) * fall * 0.07;
          const py = y0 + (y0 - my) * fall * 0.34;
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }

      ctx.font = `500 11px ${getComputedStyle(document.body).fontFamily}`;
      ctx.textBaseline = "middle";
      HOURS.forEach((stamp, index) => {
        const y0 = ((index + 0.7) / HOURS.length) * height;
        const dist = Math.hypot(28 - mx, y0 - my);
        const fall = Math.exp(-(dist * dist) / (2 * radius * radius));
        ctx.fillStyle = `rgba(${ink}, ${0.18 + fall * 0.28})`;
        ctx.fillText(
          stamp,
          18 + (28 - mx) * fall * 0.04,
          y0 + (y0 - my) * fall * 0.2,
        );
      });
    };

    const tick = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (!reduce) {
        mx += (tx - mx) * (1 - Math.exp(-dt * 7.5));
        my += (ty - my) * (1 - Math.exp(-dt * 7.5));
      }
      draw();
      frame = window.requestAnimationFrame(tick);
    };

    resize();
    draw();
    if (!reduce) {
      frame = window.requestAnimationFrame(tick);
      window.addEventListener("pointermove", onMove);
      document.documentElement.addEventListener("pointerleave", onLeave);
    }
    window.addEventListener("resize", resize);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
