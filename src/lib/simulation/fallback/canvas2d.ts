/**
 * Canvas2D N-body integrator — CPU Euler fallback.
 *
 * Used when WebGPU is unavailable. Supports up to ~64 bodies at reasonable speed.
 * Uses the same BodyData type and AU/M☉/yr unit system as the GPU path.
 * G_SIM = 4π² matches the GPU compute shader constant.
 */

import type { BodyData } from '../physics/bodies.js';

const G_SIM = 4 * Math.PI * Math.PI;
const SOFTENING_SQ = 1e-6;
const MAX_CPU_BODIES = 64;

/**
 * Advance one Euler integration step in-place.
 * For n ≤ 64 the O(n²) cost is negligible on CPU.
 */
export function eulerStep(bodies: BodyData[], dt: number): void {
  const n = Math.min(bodies.length, MAX_CPU_BODIES);

  // Compute accelerations
  const ax = new Float64Array(n);
  const ay = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    if (!bodies[i].active) continue;
    for (let j = 0; j < n; j++) {
      if (i === j || !bodies[j].active) continue;
      const dx = bodies[j].x - bodies[i].x;
      const dy = bodies[j].y - bodies[i].y;
      const dist2 = dx * dx + dy * dy + SOFTENING_SQ;
      const inv3  = 1.0 / (dist2 * Math.sqrt(dist2));
      const f     = G_SIM * bodies[j].mass * inv3;
      ax[i] += f * dx;
      ay[i] += f * dy;
    }
  }

  // Integrate
  for (let i = 0; i < n; i++) {
    if (!bodies[i].active) continue;
    bodies[i].vx += ax[i] * dt;
    bodies[i].vy += ay[i] * dt;
    bodies[i].x  += bodies[i].vx * dt;
    bodies[i].y  += bodies[i].vy * dt;
  }
}

type BodyTypeColors = Record<number, string>;
const BODY_COLORS: BodyTypeColors = {
  0: '#fff5cc', // STAR
  1: '#4488ff', // PLANET
  2: '#aa8866', // ASTEROID
  3: '#cc2222', // BLACK_HOLE
};

/** Minimum screen radius per body type (px) — ensures bodies are always visible. */
const MIN_RADIUS: Record<number, number> = {
  0: 8,  // STAR
  1: 4,  // PLANET
  2: 3,  // ASTEROID
  3: 6,  // BLACK_HOLE
};

/**
 * Render bodies onto a 2D canvas context.
 *
 * @param ctx         Canvas 2D context
 * @param bodies      Current body state
 * @param pixPerAU    Pixels per AU (from Camera.pixelsPerAU)
 * @param originX     World origin X in screen-pixels
 * @param originY     World origin Y in screen-pixels
 */
export function render2D(
  ctx:      CanvasRenderingContext2D,
  bodies:   BodyData[],
  pixPerAU: number,
  originX:  number,
  originY:  number,
): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = '#000010';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (const b of bodies) {
    if (!b.active) continue;

    const sx = originX + b.x * pixPerAU;
    const sy = originY - b.y * pixPerAU; // y-axis flip for screen coords
    const minR = MIN_RADIUS[b.type] ?? 3;
    const r  = Math.max(minR, b.radius * pixPerAU);

    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);

    const color = BODY_COLORS[b.type] ?? '#ffffff';
    const grad  = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 3);
    grad.addColorStop(0, color);
    grad.addColorStop(0.4, color);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fill();
  }
}

export { MAX_CPU_BODIES };
