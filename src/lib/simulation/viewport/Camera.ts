/**
 * Camera — 2D pan/zoom with world↔screen coordinate transforms.
 *
 * World units: AU (astronomical units).
 * Screen units: pixels (CSS px, device-independent).
 *
 * The view matrix maps world coords → NDC via an orthographic projection.
 * All matrix math uses column-major Float32Arrays compatible with WGSL mat4x4<f32>.
 */

/** Zoom range: 1e-6 AU/px (galaxy scale) → 1e4 AU/px (sub-AU scale). */
const MIN_PIXELS_PER_AU = 1e-6;
const MAX_PIXELS_PER_AU = 1e4;

export interface CameraState {
  /** World-space center of the viewport (AU). */
  centerX: number;
  centerY: number;
  /** Pixels per AU. Higher = more zoomed in. */
  pixelsPerAU: number;
}

export class Camera {
  centerX: number;
  centerY: number;
  pixelsPerAU: number;

  private canvasWidth  = 1;
  private canvasHeight = 1;

  constructor(state?: Partial<CameraState>) {
    this.centerX     = state?.centerX     ?? 0;
    this.centerY     = state?.centerY     ?? 0;
    this.pixelsPerAU = state?.pixelsPerAU ?? 100; // 100 px/AU default
  }

  /** Update canvas dimensions. Call on every resize. */
  setViewport(width: number, height: number): void {
    this.canvasWidth  = width;
    this.canvasHeight = height;
  }

  // ---------------------------------------------------------------------------
  // Coordinate transforms
  // ---------------------------------------------------------------------------

  /** Convert a world point (AU) to screen position (px). */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const x = (worldX - this.centerX) * this.pixelsPerAU + this.canvasWidth  * 0.5;
    const y = (this.centerY - worldY) * this.pixelsPerAU + this.canvasHeight * 0.5; // Y flipped
    return { x, y };
  }

  /** Convert a screen position (px) to world point (AU). */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const x = (screenX - this.canvasWidth  * 0.5) / this.pixelsPerAU + this.centerX;
    const y = this.centerY - (screenY - this.canvasHeight * 0.5) / this.pixelsPerAU;
    return { x, y };
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  /** Pan by a screen-space delta (px). */
  pan(dx: number, dy: number): void {
    this.centerX -= dx / this.pixelsPerAU;
    this.centerY += dy / this.pixelsPerAU; // screen Y is inverted
  }

  /**
   * Zoom toward a screen-space focal point.
   * @param factor  Multiplier (>1 = zoom in, <1 = zoom out)
   * @param focalX  Focal point in screen pixels (defaults to canvas centre)
   * @param focalY
   */
  zoom(factor: number, focalX?: number, focalY?: number): void {
    const fx = focalX ?? this.canvasWidth  * 0.5;
    const fy = focalY ?? this.canvasHeight * 0.5;

    // World position under focal point before zoom
    const worldFocal = this.screenToWorld(fx, fy);

    this.pixelsPerAU = Math.min(
      MAX_PIXELS_PER_AU,
      Math.max(MIN_PIXELS_PER_AU, this.pixelsPerAU * factor),
    );

    // Reposition so the focal world point stays under the cursor
    const afterScreen = this.worldToScreen(worldFocal.x, worldFocal.y);
    this.pan(afterScreen.x - fx, afterScreen.y - fy);
  }

  // ---------------------------------------------------------------------------
  // GPU uniform
  // ---------------------------------------------------------------------------

  /**
   * Build the orthographic view-projection matrix as a column-major Float32Array.
   * Also returns pixelsPerAU so the vertex shader can scale body radii.
   *
   * WGSL mat4x4<f32> is column-major:
   *   col0=[m0,m1,m2,m3], col1=[m4,m5,m6,m7], col2=[m8..], col3=[m12..]
   */
  buildViewProjMatrix(): Float32Array {
    const { canvasWidth: W, canvasHeight: H, centerX, centerY, pixelsPerAU } = this;

    // Orthographic: map world rectangle to [-1,1]² NDC
    // scaleX = 2 * pixelsPerAU / W   (world units → NDC)
    // scaleY = 2 * pixelsPerAU / H   (with Y flip already in shader? no — flip here)
    const sx =  2 * pixelsPerAU / W;
    const sy = -2 * pixelsPerAU / H; // flip Y (screen down = world down)
    const tx = -centerX * sx;
    const ty = -centerY * sy;

    // Column-major mat4x4<f32>
    // [ sx  0  0  tx ]
    // [  0 sy  0  ty ]
    // [  0  0  1   0 ]
    // [  0  0  0   1 ]
    const m = new Float32Array(16);
    m[0]  = sx;
    m[5]  = sy;
    m[10] = 1;
    m[15] = 1;
    m[12] = tx;
    m[13] = ty;
    return m;
  }

  get state(): CameraState {
    return {
      centerX:     this.centerX,
      centerY:     this.centerY,
      pixelsPerAU: this.pixelsPerAU,
    };
  }
}
