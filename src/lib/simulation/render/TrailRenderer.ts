/**
 * TrailRenderer — GPU trail ring buffer for N-body particles.
 *
 * Architecture:
 *   - One circular float32 buffer: [x, y, age] per sample, TRAIL_LENGTH samples per body.
 *   - A CPU-side write head per body advances each frame.
 *   - Written via writeBuffer each frame for the active body slots only.
 *   - Rendered as line-strip primitives, one draw call per body (only when trails enabled).
 *
 * Performance trade-offs:
 *   - TRAIL_LENGTH = 128: 128 × MAX_TRAILS × 12 bytes = ~6 MB for 4096 bodies (acceptable)
 *   - Disabled by default — no GPU cost when off.
 */

const TRAIL_LENGTH  = 128;  // samples per body
const FLOATS_PER_PT = 3;    // x, y, age (0=newest, 1=oldest)
const TRAIL_SHADER  = /* wgsl */`
struct Camera {
  viewProj    : mat4x4<f32>,
  pixelsPerAU : f32,
  _pad0 : f32, _pad1 : f32, _pad2 : f32,
};

@group(0) @binding(0) var<storage, read> trail : array<f32>;
@group(0) @binding(1) var<uniform> camera : Camera;
@group(0) @binding(2) var<uniform> params : vec2<u32>; // x=trailLen, y=writeHead (for this body)

struct VertOut {
  @builtin(position) position : vec4<f32>,
  @location(0) alpha : f32,
};

@vertex
fn vs(
  @builtin(vertex_index)   vi : u32,
  @builtin(instance_index) bodyIdx : u32,
) -> VertOut {
  let trailLen = params.x;
  let writeHead = params.y;
  // Oldest sample first: slot = (writeHead + vi) % trailLen
  let slot = (writeHead + vi) % trailLen;
  let base = (bodyIdx * trailLen + slot) * 3u;

  let x   = trail[base + 0u];
  let y   = trail[base + 1u];
  let age = trail[base + 2u]; // 0.0 = newest, 1.0 = oldest

  var out : VertOut;
  out.position = camera.viewProj * vec4<f32>(x, y, 0.0, 1.0);
  out.alpha = (1.0 - age) * 0.6; // fade out older points
  return out;
}

@fragment
fn fs(in : VertOut) -> @location(0) vec4<f32> {
  return vec4<f32>(0.6, 0.8, 1.0, in.alpha); // blue-white trail colour
}
`;

export class TrailRenderer {
  enabled = false;

  private readonly device: GPUDevice;
  private readonly maxBodies: number;
  private pipeline: GPURenderPipeline | null = null;

  /** CPU-side ring buffer data */
  private cpuBuffer: Float32Array;
  /** Write heads per body (index into the ring) */
  private writeHeads: Uint32Array;
  private gpuTrailBuf: GPUBuffer;
  private cameraBuffer: GPUBuffer;
  private paramsBuffer: GPUBuffer;
  private bindGroup: GPUBindGroup | null = null;

  constructor(device: GPUDevice, maxBodies: number) {
    this.device     = device;
    this.maxBodies  = maxBodies;

    const floats = maxBodies * TRAIL_LENGTH * FLOATS_PER_PT;
    this.cpuBuffer  = new Float32Array(floats);
    this.writeHeads = new Uint32Array(maxBodies);

    this.gpuTrailBuf = device.createBuffer({
      label: 'trail-data',
      size:  floats * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.cameraBuffer = device.createBuffer({
      label: 'trail-camera',
      size:  80,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.paramsBuffer = device.createBuffer({
      label: 'trail-params',
      size:  8,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  async init(targetFormat: GPUTextureFormat): Promise<void> {
    const { device } = this;
    const mod = device.createShaderModule({ code: TRAIL_SHADER });

    const bgl = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
        { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
      ],
    });

    this.pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
      vertex:   { module: mod, entryPoint: 'vs' },
      fragment: { module: mod, entryPoint: 'fs',
        targets: [{ format: targetFormat, blend: {
          color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
        }}],
      },
      primitive: { topology: 'line-strip', stripIndexFormat: undefined },
    });

    this.bindGroup = device.createBindGroup({
      layout: bgl,
      entries: [
        { binding: 0, resource: { buffer: this.gpuTrailBuf } },
        { binding: 1, resource: { buffer: this.cameraBuffer } },
        { binding: 2, resource: { buffer: this.paramsBuffer } },
      ],
    });
  }

  /** Push the current positions of active bodies into the CPU ring buffer. */
  pushPositions(bodies: { x: number; y: number; active: number }[]): void {
    if (!this.enabled) return;

    const n = Math.min(bodies.length, this.maxBodies);
    for (let i = 0; i < n; i++) {
      const b = bodies[i];
      if (!b.active) continue;

      const head = this.writeHeads[i];
      const base = (i * TRAIL_LENGTH + head) * FLOATS_PER_PT;
      this.cpuBuffer[base]     = b.x;
      this.cpuBuffer[base + 1] = b.y;
      this.cpuBuffer[base + 2] = 0; // newest — will age below

      // Age all existing samples for this body
      for (let s = 0; s < TRAIL_LENGTH; s++) {
        const sb = (i * TRAIL_LENGTH + s) * FLOATS_PER_PT + 2;
        if (s !== head) {
          this.cpuBuffer[sb] = Math.min(this.cpuBuffer[sb] + (1 / TRAIL_LENGTH), 1);
        }
      }

      this.writeHeads[i] = (head + 1) % TRAIL_LENGTH;
    }

    // Upload to GPU
    this.device.queue.writeBuffer(this.gpuTrailBuf, 0, this.cpuBuffer);
  }

  uploadCamera(viewProj: Float32Array, pixelsPerAU: number): void {
    const data = new Float32Array(20);
    data.set(viewProj, 0);
    data[16] = pixelsPerAU;
    this.device.queue.writeBuffer(this.cameraBuffer, 0, data);
  }

  /**
   * Record trail render pass into the HDR texture (called before bloom).
   */
  render(
    encoder: GPUCommandEncoder,
    hdrView: GPUTextureView,
    nBodies: number,
  ): void {
    if (!this.enabled || !this.pipeline || !this.bindGroup) return;

    // Upload params: trailLength + a dummy writeHead (shader reads per-body head from buffer)
    this.device.queue.writeBuffer(
      this.paramsBuffer, 0,
      new Uint32Array([TRAIL_LENGTH, 0]),
    );

    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: hdrView,
        loadOp:  'load',   // preserve existing particle render
        storeOp: 'store',
      }],
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    // One instance per body, TRAIL_LENGTH vertices each (line-strip)
    pass.draw(TRAIL_LENGTH, nBodies, 0, 0);
    pass.end();
  }

  /** Reset all trails (e.g. on preset load). */
  reset(): void {
    this.cpuBuffer.fill(0);
    this.writeHeads.fill(0);
    this.device.queue.writeBuffer(this.gpuTrailBuf, 0, this.cpuBuffer);
  }

  destroy(): void {
    this.gpuTrailBuf.destroy();
    this.cameraBuffer.destroy();
    this.paramsBuffer.destroy();
  }
}

export { TRAIL_LENGTH };
