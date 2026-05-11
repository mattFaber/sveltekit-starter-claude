/**
 * Vertex shader — instanced quad rendering for N-body particles.
 *
 * Each body is rendered as a unit quad (2 triangles, 6 vertices).
 * The vertex shader reads body position + velocity directly from the compute
 * output storage buffer — zero GPU→CPU→GPU round-trip.
 *
 * Camera uniform (set 1, binding 0):
 *   viewProj : mat4x4<f32>   — world-to-clip transform
 *   scale    : f32            — world units per pixel (for radius scaling)
 *
 * Outputs to fragment shader:
 *   uv       : vec2<f32>   — [-1,1] within the quad
 *   color    : vec4<f32>   — body-type colour
 *   radius   : f32         — body radius in pixels (for SDF)
 */
export const PARTICLE_VERT_SHADER = /* wgsl */`

struct CameraUniforms {
  viewProj : mat4x4<f32>,
  // Pixels per AU — used to convert body radius (AU) → screen pixels
  pixelsPerAU : f32,
  _pad0 : f32,
  _pad1 : f32,
  _pad2 : f32,
};

struct VertexOut {
  @builtin(position) position : vec4<f32>,
  @location(0) uv     : vec2<f32>,
  @location(1) color  : vec4<f32>,
  @location(2) radius : f32,
};

// Body position+velocity buffer (output of compute pass, read directly here)
@group(0) @binding(0) var<storage, read> posVel : array<vec4<f32>>;
// Body properties: mass, radius, type, active
@group(0) @binding(1) var<storage, read> props  : array<vec4<f32>>;

@group(1) @binding(0) var<uniform> camera : CameraUniforms;

// Unit quad corners: two triangles covering [-1,1]²
const QUAD_POS = array<vec2<f32>, 6>(
  vec2<f32>(-1.0, -1.0),
  vec2<f32>( 1.0, -1.0),
  vec2<f32>(-1.0,  1.0),
  vec2<f32>(-1.0,  1.0),
  vec2<f32>( 1.0, -1.0),
  vec2<f32>( 1.0,  1.0),
);

// Body type → base colour (STAR=0, PLANET=1, ASTEROID=2, BLACK_HOLE=3)
fn bodyColor(body_type: f32) -> vec4<f32> {
  let t = u32(body_type + 0.5);
  switch t {
    case 0u: { return vec4<f32>(1.0,  0.95, 0.6,  1.0); } // star: warm white-yellow
    case 1u: { return vec4<f32>(0.3,  0.6,  1.0,  1.0); } // planet: blue
    case 2u: { return vec4<f32>(0.55, 0.5,  0.45, 1.0); } // asteroid: grey-brown
    case 3u: { return vec4<f32>(0.8,  0.1,  0.15, 1.0); } // black hole: deep red
    default: { return vec4<f32>(1.0,  1.0,  1.0,  1.0); }
  }
}

@vertex
fn main(
  @builtin(vertex_index)   vertex_idx   : u32,
  @builtin(instance_index) instance_idx : u32,
) -> VertexOut {
  let pv     = posVel[instance_idx];
  let prop   = props[instance_idx];
  let active = prop.w;

  let world_pos = vec2<f32>(pv.x, pv.y);
  let radius_au = prop.y;
  // Minimum screen radius so even tiny bodies are visible
  let radius_px = max(radius_au * camera.pixelsPerAU, 2.0);

  let corner = QUAD_POS[vertex_idx];
  // Convert corner offset from pixels to world units, then apply to world pos
  let offset_world = corner * (radius_px / camera.pixelsPerAU) * 1.5; // 1.5× for glow margin
  let final_world  = world_pos + offset_world;

  var out : VertexOut;
  out.position = camera.viewProj * vec4<f32>(final_world, 0.0, 1.0);
  // Hide inactive bodies by pushing them to w=0 (degenerate clip-space)
  if active < 0.5 {
    out.position = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  }
  out.uv     = corner;
  out.color  = bodyColor(prop.z);
  out.radius = radius_px;
  return out;
}
`;
