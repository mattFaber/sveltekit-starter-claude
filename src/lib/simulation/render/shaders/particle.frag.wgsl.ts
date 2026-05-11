/**
 * Fragment shader — SDF circle with radial glow.
 *
 * Inputs from vertex shader:
 *   uv     : vec2<f32>  — [-1,1] within the quad
 *   color  : vec4<f32>  — body-type colour
 *   radius : f32        — body radius in pixels
 *
 * Outputs HDR colour (rgba16float target) so bloom can pick up bright cores.
 */
export const PARTICLE_FRAG_SHADER = /* wgsl */`

struct FragIn {
  @builtin(position) position : vec4<f32>,
  @location(0) uv     : vec2<f32>,
  @location(1) color  : vec4<f32>,
  @location(2) radius : f32,
};

@fragment
fn main(in: FragIn) -> @location(0) vec4<f32> {
  // SDF: distance from centre in uv-space (1.0 = quad edge)
  let d = length(in.uv);

  // Discard anything outside the glow radius (1.5× actual radius)
  if d > 1.0 {
    discard;
  }

  // Hard disc inside actual radius
  // uv is normalised so radius_px maps to uv 1/1.5 ≈ 0.667
  let disc_edge = 0.667;
  let in_disc = step(d, disc_edge);

  // Core: solid body colour (bright, feeds bloom)
  let core = in.color * in_disc;

  // Glow halo outside the disc: exponential falloff
  let halo_t = clamp((d - disc_edge) / (1.0 - disc_edge), 0.0, 1.0);
  let halo   = in.color * (1.0 - in_disc) * exp(-halo_t * 4.0) * 0.8;

  // HDR: let core exceed 1.0 for bloom to pick up bright stars
  let hdr_boost = select(1.0, 3.0, in.color.r > 0.9 && in.color.b < 0.5); // star boost
  let out_color = (core * hdr_boost + halo);

  // Alpha: fully opaque inside disc, fading halo
  let alpha = mix(exp(-halo_t * 3.0), 1.0, in_disc);

  return vec4<f32>(out_color.rgb, alpha);
}
`;
