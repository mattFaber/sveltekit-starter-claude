/**
 * TrailRenderer — GPU trail ring buffer for N-body particles.
 *
 * Architecture:
 *   - One circular float32 buffer: [x, y] per sample, TRAIL_LENGTH samples per body.
 *   - A single global write head advances each frame (all bodies stay in sync).
 *   - Age is derived in the vertex shader from vertex_index — no CPU aging loop needed.
 *   - Rendered as line-strip, nBodies instances, TRAIL_LENGTH vertices each.
 *
 * WGSL compliance:
 *   - `vec2<u32>` uniform replaced with a proper `struct TrailParams` (16 bytes)
 *   - No trailing semicolons on struct declarations
 *   - All pad fields on separate lines, no `_` prefix
 *   - Shader module labelled for easier debugging
 *
 * Performance:
 *   - CPU work per frame: O(n) — no per-body O(TRAIL_LENGTH) aging loop
 *   - Buffer: maxBodies × TRAIL_LENGTH × 2 floats ≈ 4 MB for 4096 bodies
 *   - Disabled by default — zero GPU cost when off
 */

const TRAIL_LENGTH  = 128;  // samples per body
const FLOATS_PER_PT = 2;    // x, y only — age derived in shader from vertex_index

const TRAIL_SHADER = /* wgsl */`
struct Camera {
  viewProj    : mat4x4<f32>,
  pixelsPerAU : f32,
  pad0        : f32,
  pad1        : f32,
  pad2        : f32,
}

struct TrailParams {
  trailLen  : u32,
  writeHead : u32,
  pad0      : u32,
  pad1      : u32,
}

@group(0) @binding(0) var<storage, read> trail  : array<f32>;
@group(0) @binding(1) var<uniform>       camera : Camera;
@group(0) @binding(2) var<uniform>       params : TrailParams;

struct VertOut {
  @builtin(position) pos   : vec4<f32>,
  @location(0)       alpha : f32,
}

@vertex
fn vs(
  @builtin(vertex_index)   vi      : u32,
  @builtin(instance_index) bodyIdx : u32,
) -> VertOut {
  let trailLen  = params.trailLen;
  let writeHead = params.writeHead;

  // vi=0 → oldest slot, vi=trailLen-1 → newest slot
  let slot = (writeHead + vi) % trailLen;
  let base = (bodyIdx * trailLen + slot) * 2u;

  let wx = trail[base];
  let wy = trail[base + 1u];

  // t=0 for oldest, t=1 for newest; alpha fades toward older points
  let t = f32(vi) / f32(trailLen - 1u);

  var out : VertOut;
  out.pos   = camera.viewProj * vec4<f32>(wx, wy, 0.0, 1.0);
  out.alpha = t * 0.6;
  return out;
}

@fragment
fn fs(@location(0) alpha : f32) -> @location(0) vec4<f32> {
  return vec4<f32>(0.55, 0.75, 1.0, alpha);
}
`;

export class TrailRenderer {
  enabled = false;

  private readonly device: GPUDevice;
  private readonly maxBodies: number;
  private pipeline: GPURenderPipeline | null = null;

  /** CPU-side ring buffer: [x, y] × TRAIL_LENGTH × maxBodies */
  private cpuBuffer: Float32Array;
  /** Single global write head — all bodies advance together each frame */
  private globalWriteHead = 0;
  /** Frames filled so far, capped at TRAIL_LENGTH — avoids drawing uninitialized slots */
  private framesFilled = 0;

  private gpuTrailBuf: GPUBuffer;
  private cameraBuffer: GPUBuffer;
  private paramsBuffer: GPUBuffer;
  private bindGroup: GPUBindGroup | null = null;

  constructor(device: GPUDevice, maxBodies: number) {
    this.device    = device;
    this.maxBodies = maxBodies;

    const floats = maxBodies * TRAIL_LENGTH * FLOATS_PER_PT;
    this.cpuBuffer = new Float32Array(floats);

    this.gpuTrailBuf = device.createBuffer({
      label: 'trail-data',
      size:  floats * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.cameraBuffer = device.createBuffer({
      label: 'trail-camera',
      size:  80,   // mat4x4<f32> (64) + 4×f32 pad (16)
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // TrailParams: 4 × u32 = 16 bytes — satisfies uniform buffer alignment
    this.paramsBuffer = device.createBuffer({
      label: 'trail-params',
      size:  16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  async init(targetFormat: GPUTextureFormat): Promise<void> {
    const { device } = this;

    const mod = device.createShaderModule({
      label: 'trail-shader',
      code:  TRAIL_SHADER,
    });

    // Surface WGSL compilation errors eagerly with line info
    const info = await mod.getCompilationInfo();
    for (const msg of info.messages) {
      if (msg.type === 'error') {
        throw new Error(`TrailRenderer WGSL [${msg.lineNum}:${msg.linePos}]: ${msg.message}`);
      }
    }

    const bgl = device.createBindGroupLayout({
      label: 'trail-bgl',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
      ],
    });

    this.pipeline = device.createRenderPipeline({
      label:  'trail-pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
      vertex:   { module: mod, entryPoint: 'vs' },
      fragment: { module: mod, entryPoint: 'fs',
        targets: [{ format: targetFormat, blend: {
          color: { srcFactor: 'src-alpha', dstFactor: 'one',                operation: 'add' },
          alpha: { srcFactor: 'one',       dstFactor: 'one-minus-src-alpha', operation: 'add' },
        }}],
      },
      primitive: { topology: 'line-strip' },
    });

    this.bindGroup = device.createBindGroup({
      label:  'trail-bindgroup',
      layout: bgl,
      entries: [
        { binding: 0, resource: { buffer: this.gpuTrailBuf } },
        { binding: 1, resource: { buffer: this.cameraBuffer } },
        { binding: 2, resource: { buffer: this.paramsBuffer } },
      ],
    });
  }

  /** Push the current positions of active bodies into the CPU ring buffer. O(n). */
  pushPositions(bodies: { x: number; y: number; active: number }[]): void {
    if (!this.enabled) return;

    const n    = Math.min(bodies.length, this.maxBodies);
    const head = this.globalWriteHead;

    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      if (!b.active) continue;
      const base = (i * TRAIL_LENGTH + head) * FLOATS_PER_PT;
      this.cpuBuffer[base]     = b.x;
      this.cpuBuffer[base + 1] = b.y;
    }

    this.globalWriteHead = (head + 1) % TRAIL_LENGTH;
    this.framesFilled    = Math.min(this.framesFilled + 1, TRAIL_LENGTH);

    this.device.queue.writeBuffer(this.gpuTrailBuf, 0, this.cpuBuffer);
  }

  uploadCamera(viewProj: Float32Array, pixelsPerAU: number): void {
    const data = new Float32Array(20);
    data.set(viewProj, 0);
    data[16] = pixelsPerAU;
    this.device.queue.writeBuffer(this.cameraBuffer, 0, data);
  }

  /** Record trail render pass into the HDR texture before bloom. */
  render(
    encoder: GPUCommandEncoder,
    hdrView: GPUTextureView,
    nBodies: number,
  ): void {
    if (!this.enabled || !this.pipeline || !this.bindGroup || this.framesFilled < 2) return;

    // Upload TrailParams: [trailLen, writeHead (= oldest slot), pad, pad]
    this.device.queue.writeBuffer(
      this.paramsBuffer, 0,
      new Uint32Array([TRAIL_LENGTH, this.globalWriteHead, 0, 0]),
    );

    const vertexCount = Math.min(this.framesFilled, TRAIL_LENGTH);

    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view:    hdrView,
        loadOp:  'load',   // preserve existing particle render
        storeOp: 'store',
      }],
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(vertexCount, nBodies, 0, 0);
    pass.end();
  }

  /** Reset all trails (e.g. on preset load or when disabled). */
  reset(): void {
    this.cpuBuffer.fill(0);
    this.globalWriteHead = 0;
    this.framesFilled    = 0;
    this.device.queue.writeBuffer(this.gpuTrailBuf, 0, this.cpuBuffer);
  }

  destroy(): void {
    this.gpuTrailBuf.destroy();
    this.cameraBuffer.destroy();
    this.paramsBuffer.destroy();
  }
}

export { TRAIL_LENGTH };
