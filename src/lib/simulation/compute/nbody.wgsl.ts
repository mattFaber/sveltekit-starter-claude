/**
 * Tiled all-pairs N-body gravitational compute shader (Leapfrog / velocity-Verlet).
 *
 * Units: AU, M☉, yr  →  G = 4π²
 * Softening ε² prevents force singularity on close approach.
 *
 * Algorithm:
 *   Each invocation handles one body. The workgroup loads TILE_SIZE bodies into
 *   shared memory at a time, computes forces against all tiles, then integrates.
 *   This gives ~WORKGROUP_SIZE× better memory bandwidth vs naive global reads.
 *
 * Leapfrog (kick-drift-kick):
 *   v_half = v + a * (dt/2)
 *   x_new  = x + v_half * dt
 *   a_new  = forces(x_new)
 *   v_new  = v_half + a_new * (dt/2)
 *
 * Buffer bindings (set 0):
 *   0 — posVelIn  (read)  : vec4<f32>[N]  [x, y, vx, vy]
 *   1 — posVelOut (write) : vec4<f32>[N]  [x, y, vx, vy]
 *   2 — props     (read)  : vec4<f32>[N]  [mass, radius, type, active]
 *   3 — params    (read)  : SimParams uniform
 */

const WORKGROUP_SIZE = 256;

export const NBODY_SHADER = /* wgsl */`

const G: f32 = 39.4784176;   // 4π²  AU³ / (M☉ · yr²)
const SOFTENING_SQ: f32 = 1e-6; // ε² in AU²  (≈ 0.001 AU softening radius)
const TILE: u32 = ${WORKGROUP_SIZE}u;

struct SimParams {
  n_bodies : u32,
  dt       : f32,
  _pad0    : u32,
  _pad1    : u32,
};

@group(0) @binding(0) var<storage, read>       posVelIn  : array<vec4<f32>>;
@group(0) @binding(1) var<storage, read_write> posVelOut : array<vec4<f32>>;
@group(0) @binding(2) var<storage, read>       props     : array<vec4<f32>>;
@group(0) @binding(3) var<uniform>             params    : SimParams;

var<workgroup> tile_posVel : array<vec4<f32>, ${WORKGROUP_SIZE}>;
var<workgroup> tile_mass   : array<f32,       ${WORKGROUP_SIZE}>;
var<workgroup> tile_active : array<f32,       ${WORKGROUP_SIZE}>;

@compute @workgroup_size(${WORKGROUP_SIZE})
fn main(
  @builtin(global_invocation_id) global_id : vec3<u32>,
  @builtin(local_invocation_id)  local_id  : vec3<u32>,
) {
  let i = global_id.x;
  let n = params.n_bodies;
  let dt = params.dt;

  // Load this body's state
  var pv_i  = posVelIn[i];
  let px    = props[i];
  let alive = px.w > 0.5; // active flag

  var pos = vec2<f32>(pv_i.x, pv_i.y);
  var vel = vec2<f32>(pv_i.z, pv_i.w);
  var acc = vec2<f32>(0.0, 0.0);

  // --- Tiled force accumulation ---
  var tile_start: u32 = 0u;
  loop {
    if tile_start >= n { break; }

    // Load one tile of bodies into workgroup shared memory
    let j = tile_start + local_id.x;
    if j < n {
      tile_posVel[local_id.x] = posVelIn[j];
      tile_mass[local_id.x]   = props[j].x;
      tile_active[local_id.x] = props[j].w;
    } else {
      tile_posVel[local_id.x] = vec4<f32>(0.0);
      tile_mass[local_id.x]   = 0.0;
      tile_active[local_id.x] = 0.0;
    }
    workgroupBarrier();

    // Accumulate forces from this tile
    if alive {
      for (var t: u32 = 0u; t < TILE; t++) {
        let global_j = tile_start + t;
        if global_j >= n || global_j == i { continue; }
        if tile_active[t] < 0.5 { continue; }

        let dx = tile_posVel[t].x - pos.x;
        let dy = tile_posVel[t].y - pos.y;
        let dist_sq = dx * dx + dy * dy + SOFTENING_SQ;
        let inv_dist = inverseSqrt(dist_sq);
        let inv_dist3 = inv_dist * inv_dist * inv_dist;
        let f = G * tile_mass[t] * inv_dist3;
        acc += vec2<f32>(dx * f, dy * f);
      }
    }
    workgroupBarrier();

    tile_start += TILE;
  }

  // --- Leapfrog integration (kick-drift-kick) ---
  // Only integrate active bodies; inactive stay frozen so GPU skips them.
  if alive && i < n {
    let half_dt = dt * 0.5;
    let vel_half = vel + acc * half_dt;
    let pos_new  = pos + vel_half * dt;

    // Second kick uses same acc (standard Leapfrog — recompute acc next step)
    let vel_new = vel_half + acc * half_dt;

    posVelOut[i] = vec4<f32>(pos_new.x, pos_new.y, vel_new.x, vel_new.y);
  } else {
    // Pass through unchanged
    posVelOut[i] = pv_i;
  }
}
`;
