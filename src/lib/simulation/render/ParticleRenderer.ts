import { PARTICLE_VERT_SHADER } from './shaders/particle.vert.wgsl.js';
import { PARTICLE_FRAG_SHADER } from './shaders/particle.frag.wgsl.js';

/** Camera uniform layout (48 bytes, std140-compatible):
 *  viewProj   : mat4x4<f32>  (64 bytes)
 *  pixelsPerAU: f32           (4 bytes)
 *  _pad x3    : f32           (12 bytes)
 *  total: 80 bytes
 */
const CAMERA_UNIFORM_SIZE = 80;

/** Renders N-body particles via instanced quads into an HDR offscreen texture. */
export class ParticleRenderer {
  private readonly device: GPUDevice;
  private pipeline: GPURenderPipeline | null = null;
  private cameraBuffer: GPUBuffer;
  private cameraBindGroup: GPUBindGroup | null = null;
  private bodyBindGroup: GPUBindGroup | null = null;
  /** HDR render target (rgba16float). Recreated on resize. */
  private hdrTexture: GPUTexture | null = null;
  private hdrView: GPUTextureView | null = null;

  constructor(device: GPUDevice) {
    this.device = device;
    this.cameraBuffer = device.createBuffer({
      size: CAMERA_UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  /** Build the render pipeline. Call once after construction. */
  async init(): Promise<void> {
    const { device } = this;
    const vertMod = device.createShaderModule({ label: 'particle-vert', code: PARTICLE_VERT_SHADER });
    const fragMod = device.createShaderModule({ label: 'particle-frag', code: PARTICLE_FRAG_SHADER });

    for (const [label, mod] of [['particle-vert', vertMod], ['particle-frag', fragMod]] as const) {
      const info = await mod.getCompilationInfo();
      for (const msg of info.messages) {
        if (msg.type === 'error') {
          throw new Error(`${label} WGSL [${msg.lineNum}:${msg.linePos}]: ${msg.message}`);
        }
      }
    }

    // Body data bind group layout (group 0)
    const bodyBGL = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
        { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      ],
    });

    // Camera bind group layout (group 1)
    const cameraBGL = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } },
      ],
    });

    this.pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bodyBGL, cameraBGL] }),
      vertex: { module: vertMod, entryPoint: 'main' },
      fragment: {
        module: fragMod,
        entryPoint: 'main',
        targets: [{ format: 'rgba16float', blend: {
          color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
          alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
        } }],
      },
      primitive: { topology: 'triangle-list' },
    });

    this.cameraBindGroup = device.createBindGroup({
      layout: cameraBGL,
      entries: [{ binding: 0, resource: { buffer: this.cameraBuffer } }],
    });
  }

  /**
   * Bind the compute output buffers.
   * Must be called whenever NBodyCompute recreates its buffers.
   */
  bindBodyBuffers(posVelBuffer: GPUBuffer, propsBuffer: GPUBuffer): void {
    if (!this.pipeline) return;
    const bodyBGL = this.pipeline.getBindGroupLayout(0);
    this.bodyBindGroup = this.device.createBindGroup({
      layout: bodyBGL,
      entries: [
        { binding: 0, resource: { buffer: posVelBuffer } },
        { binding: 1, resource: { buffer: propsBuffer } },
      ],
    });
  }

  /**
   * Resize (or create) the HDR offscreen texture.
   * Call when the canvas size changes.
   */
  resize(width: number, height: number): void {
    this.hdrTexture?.destroy();
    this.hdrTexture = this.device.createTexture({
      size: { width, height },
      format: 'rgba16float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.hdrView = this.hdrTexture.createView();
  }

  /** Upload camera matrices from a flat 16-element mat4 + pixelsPerAU scalar. */
  uploadCamera(viewProj: Float32Array, pixelsPerAU: number): void {
    const data = new Float32Array(20); // 16 + 4 floats
    data.set(viewProj, 0);
    data[16] = pixelsPerAU;
    // data[17..19] = pad (zeroed by Float32Array default)
    this.device.queue.writeBuffer(this.cameraBuffer, 0, data);
  }

  /**
   * Record a render pass into the provided command encoder.
   * Returns the HDR view for the subsequent bloom pass.
   */
  render(
    encoder: GPUCommandEncoder,
    nBodies: number,
  ): GPUTextureView | null {
    if (!this.pipeline || !this.bodyBindGroup || !this.cameraBindGroup || !this.hdrView) {
      return null;
    }

    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.hdrView,
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });

    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bodyBindGroup);
    pass.setBindGroup(1, this.cameraBindGroup);
    // 6 vertices per quad, nBodies instances
    pass.draw(6, nBodies, 0, 0);
    pass.end();

    return this.hdrView;
  }

  get hdrTextureView(): GPUTextureView | null {
    return this.hdrView;
  }

  get hdrGPUTexture(): GPUTexture | null {
    return this.hdrTexture;
  }

  destroy(): void {
    this.cameraBuffer.destroy();
    this.hdrTexture?.destroy();
    this.pipeline = null;
  }
}
