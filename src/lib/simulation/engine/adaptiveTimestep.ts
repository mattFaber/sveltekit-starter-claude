import type { BodyData } from '../physics/bodies.js';

/**
 * Adaptive timestep for the N-body integrator.
 *
 * Strategy: Courant-like condition — the timestep must be smaller than the
 * minimum time for any body to travel its own radius.
 *
 *   dt_safe_i = radius_i / |v_i|    for each active body i
 *   dt_safe   = min(dt_safe_i)      (worst case)
 *
 * To avoid jerky changes, dt_safe is exponentially smoothed and clamped
 * to never exceed 4× the previous step.
 *
 * Units: AU / (AU/yr) = yr — all consistent with the simulation unit system.
 */

export interface AdaptiveState {
  safedt:     number;  // last computed safe dt (yr)
  smootheddt: number;  // EMA-smoothed dt (yr)
}

const SMOOTH_ALPHA = 0.1;   // EMA factor — lower = smoother but slower response
const MAX_FACTOR   = 4.0;   // never grow dt more than 4× per frame
const MIN_DT       = 1e-6;  // yr — absolute minimum (prevents zero-dt freeze)
const MAX_DT       = 1.0;   // yr — absolute maximum (1 year per step)

/**
 * Compute a safe adaptive dt from the current body state.
 *
 * @param bodies       CPU snapshot of current body positions/velocities
 * @param requestedDt  The dt the user wants (from timeScale)
 * @param state        Previous adaptive state (updated in-place)
 * @returns `{ dt, state }` where dt ≤ requestedDt and dt ≤ safedt
 */
export function adaptiveTimestep(
  bodies:      BodyData[],
  requestedDt: number,
  state:       AdaptiveState,
): { dt: number; state: AdaptiveState } {
  let minSafe = Infinity;

  for (const b of bodies) {
    if (!b.active) continue;
    const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
    if (speed < 1e-12) continue;                 // stationary body — skip
    const tCross = b.radius / speed;             // time to cross own radius
    if (tCross < minSafe) minSafe = tCross;
  }

  if (!isFinite(minSafe)) minSafe = requestedDt; // all bodies stationary

  // EMA smoothing
  const smoothed = SMOOTH_ALPHA * minSafe + (1 - SMOOTH_ALPHA) * state.smootheddt;

  // Clamp growth: never let dt jump more than 4× even if conditions improve suddenly
  const maxAllowed = Math.min(state.smootheddt * MAX_FACTOR, MAX_DT);
  const safedt     = Math.max(MIN_DT, Math.min(smoothed, maxAllowed));

  // Final dt: user-requested, but capped to safe value
  const dt = Math.min(requestedDt, safedt);

  return { dt, state: { safedt, smootheddt: smoothed } };
}
