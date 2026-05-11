/**
 * 4-pass HDR bloom:
 *   1. Threshold pass  — extract bright pixels (luminance > threshold)
 *   2. Horizontal blur — 9-tap Gaussian
 *   3. Vertical blur   — 9-tap Gaussian
 *   4. Composite       — additive blend onto swap-chain texture
 */

const THRESHOLD_SHADER = /* wgsl */`
@group(0) @binding(0) var src     : texture_2d<f32>;
@group(0) @binding(1) var srcSamp : sampler;
@group(0) @binding(2) var<uniform> threshold : f32;

struct VertOut { @builtin(position) pos : vec4<f32>, @location(0) uv : vec2<f32> };

@vertex
fn vs(@builtin(vertex_index) vi : u32) -> VertOut {
  // Full-screen triangle
  let x = f32((vi << 1u) & 2u) * 2.0 - 1.0;
  let y = f32(vi & 2u) * 2.0 - 1.0;
  var out : VertOut;
  out.pos = vec4<f32>(x, y, 0.0, 1.0);
  out.uv  = vec2<f32>(x * 0.5 + 0.5, 0.5 - y * 0.5);
  return out;
}

@fragment
fn fs(in : VertOut) -> @location(0) vec4<f32> {
  let c = textureSample(src, srcSamp, in.uv);
  let lum = dot(c.rgb, vec3<f32>(0.2126, 0.7152, 0.0722));
  let bright = max(lum - threshold, 0.0) / max(lum, 0.001);
  return vec4<f32>(c.rgb * bright, 1.0);
}
`;

const BLUR_SHADER = /* wgsl */`
@group(0) @binding(0) var src     : texture_2d<f32>;
@group(0) @binding(1) var srcSamp : sampler;
@group(0) @binding(2) var<uniform> dir : vec2<f32>; // (1,0) or (0,1)

struct VertOut { @builtin(position) pos : vec4<f32>, @location(0) uv : vec2<f32> };

@vertex
fn vs(@builtin(vertex_index) vi : u32) -> VertOut {
  let x = f32((vi << 1u) & 2u) * 2.0 - 1.0;
  let y = f32(vi & 2u) * 2.0 - 1.0;
  var out : VertOut;
  out.pos = vec4<f32>(x, y, 0.0, 1.0);
  out.uv  = vec2<f32>(x * 0.5 + 0.5, 0.5 - y * 0.5);
  return out;
}

// 9-tap Gaussian weights
const W0 : f32 = 0.2270270270;
const W1 : f32 = 0.1945945946;
const W2 : f32 = 0.1216216216;
const W3 : f32 = 0.0540540541;
const W4 : f32 = 0.0162162162;

@fragment
fn fs(in : VertOut) -> @location(0) vec4<f32> {
  let size = vec2<f32>(textureDimensions(src));
  let step = dir / size;
  var col = textureSample(src, srcSamp, in.uv) * W0;
  col += textureSample(src, srcSamp, in.uv + step * 1.0) * W1;
  col += textureSample(src, srcSamp, in.uv - step * 1.0) * W1;
  col += textureSample(src, srcSamp, in.uv + step * 2.0) * W2;
  col += textureSample(src, srcSamp, in.uv - step * 2.0) * W2;
  col += textureSample(src, srcSamp, in.uv + step * 3.0) * W3;
  col += textureSample(src, srcSamp, in.uv - step * 3.0) * W3;
  col += textureSample(src, srcSamp, in.uv + step * 4.0) * W4;
  col += textureSample(src, srcSamp, in.uv - step * 4.0) * W4;
  return col;
}
`;

const COMPOSITE_SHADER = /* wgsl */`
@group(0) @binding(0) var hdr      : texture_2d<f32>;
@group(0) @binding(1) var bloom    : texture_2d<f32>;
@group(0) @binding(2) var samp     : sampler;
@group(0) @binding(3) var<uniform> params : vec2<f32>; // x=bloomStrength, y=exposure

struct VertOut { @builtin(position) pos : vec4<f32>, @location(0) uv : vec2<f32> };

@vertex
fn vs(@builtin(vertex_index) vi : u32) -> VertOut {
  let x = f32((vi << 1u) & 2u) * 2.0 - 1.0;
  let y = f32(vi & 2u) * 2.0 - 1.0;
  var out : VertOut;
  out.pos = vec4<f32>(x, y, 0.0, 1.0);
  out.uv  = vec2<f32>(x * 0.5 + 0.5, 0.5 - y * 0.5);
  return out;
}

// ACES filmic tonemapper (Narkowicz 2015)
fn aces(x : vec3<f32>) -> vec3<f32> {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), vec3<f32>(0.0), vec3<f32>(1.0));
}

@fragment
fn fs(in : VertOut) -> @location(0) vec4<f32> {
  let hdrCol   = textureSample(hdr,   samp, in.uv).rgb;
  let bloomCol = textureSample(bloom, samp, in.uv).rgb;
  let exposure = params.y;
  let strength = params.x;
  let combined = hdrCol + bloomCol * strength;
  let tonemapped = aces(combined * exposure);
  // sRGB gamma correction
  let gamma = pow(tonemapped, vec3<f32>(1.0 / 2.2));
  return vec4<f32>(gamma, 1.0);
}
`;

export class BloomPass {
  private readonly device: GPUDevice;
  private sampler: GPUSampler;

  // Pipelines
  private thresholdPipeline: GPURenderPipeline | null = null;
  private blurPipeline: GPURenderPipeline | null = null;
  private compositePipeline: GPURenderPipeline | null = null;

  // Intermediate textures (recreated on resize)
  private brightTex: GPUTexture | null = null;
  private blurHTex: GPUTexture | null = null;
  private blurVTex: GPUTexture | null = null;

  // Uniform buffers
  private thresholdBuf: GPUBuffer;
  private blurHDirBuf: GPUBuffer;
  private blurVDirBuf: GPUBuffer;
  private compositeBuf: GPUBuffer;

  // Settings
  bloomStrength = 1.2;
  threshold = 0.8;
  exposure = 1.0;

  constructor(device: GPUDevice) {
    this.device = device;

    this.sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
    });

    this.thresholdBuf = device.createBuffer({
      size: 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.blurHDirBuf = device.createBuffer({
      size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.blurVDirBuf = device.createBuffer({
      size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.compositeBuf = device.createBuffer({
      size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Upload static blur direction vectors
    device.queue.writeBuffer(this.blurHDirBuf, 0, new Float32Array([1.0, 0.0]));
    device.queue.writeBuffer(this.blurVDirBuf, 0, new Float32Array([0.0, 1.0]));
  }

  async init(swapChainFormat: GPUTextureFormat): Promise<void> {
    const { device } = this;

    const texBGL = (n: number) => device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: n === 2 ? 'uniform' : 'uniform' } },
      ],
    });

    const compositeBGL = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      ],
    });

    const makeFullscreenPipeline = (
      code: string,
      format: GPUTextureFormat,
      bgl: GPUBindGroupLayout,
    ): GPURenderPipeline => {
      const mod = device.createShaderModule({ code });
      return device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
        vertex:   { module: mod, entryPoint: 'vs' },
        fragment: { module: mod, entryPoint: 'fs', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
      });
    };

    this.thresholdPipeline  = makeFullscreenPipeline(THRESHOLD_SHADER,  'rgba16float', texBGL(0));
    this.blurPipeline       = makeFullscreenPipeline(BLUR_SHADER,       'rgba16float', texBGL(1));
    this.compositePipeline  = makeFullscreenPipeline(COMPOSITE_SHADER,  swapChainFormat, compositeBGL);
  }

  resize(width: number, height: number): void {
    this.brightTex?.destroy();
    this.blurHTex?.destroy();
    this.blurVTex?.destroy();

    const desc = (label: string): GPUTextureDescriptor => ({
      label,
      size: { width, height },
      format: 'rgba16float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });

    this.brightTex = this.device.createTexture(desc('bloom-bright'));
    this.blurHTex  = this.device.createTexture(desc('bloom-blurH'));
    this.blurVTex  = this.device.createTexture(desc('bloom-blurV'));
  }

  /**
   * Run all 4 bloom passes and composite onto the provided swap-chain view.
   * @param encoder     Current frame's command encoder
   * @param hdrView     HDR texture from ParticleRenderer
   * @param outputView  Swap-chain texture view (destination)
   */
  render(
    encoder: GPUCommandEncoder,
    hdrTexture: GPUTexture,
    outputView: GPUTextureView,
  ): void {
    if (
      !this.thresholdPipeline ||
      !this.blurPipeline ||
      !this.compositePipeline ||
      !this.brightTex ||
      !this.blurHTex ||
      !this.blurVTex
    ) return;

    const { device, sampler } = this;

    // Update dynamic uniforms
    device.queue.writeBuffer(this.thresholdBuf, 0, new Float32Array([this.threshold]));
    device.queue.writeBuffer(this.compositeBuf, 0, new Float32Array([this.bloomStrength, this.exposure]));

    const hdrView    = hdrTexture.createView();
    const brightView = this.brightTex.createView();
    const blurHView  = this.blurHTex.createView();
    const blurVView  = this.blurVTex.createView();

    // --- Pass 1: threshold ---
    {
      const bg = device.createBindGroup({
        layout: this.thresholdPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: hdrView },
          { binding: 1, resource: sampler },
          { binding: 2, resource: { buffer: this.thresholdBuf } },
        ],
      });
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: brightView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
      });
      pass.setPipeline(this.thresholdPipeline);
      pass.setBindGroup(0, bg);
      pass.draw(3);
      pass.end();
    }

    // --- Pass 2: horizontal blur ---
    {
      const bg = device.createBindGroup({
        layout: this.blurPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: brightView },
          { binding: 1, resource: sampler },
          { binding: 2, resource: { buffer: this.blurHDirBuf } },
        ],
      });
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: blurHView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
      });
      pass.setPipeline(this.blurPipeline);
      pass.setBindGroup(0, bg);
      pass.draw(3);
      pass.end();
    }

    // --- Pass 3: vertical blur ---
    {
      const bg = device.createBindGroup({
        layout: this.blurPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: blurHView },
          { binding: 1, resource: sampler },
          { binding: 2, resource: { buffer: this.blurVDirBuf } },
        ],
      });
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: blurVView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
      });
      pass.setPipeline(this.blurPipeline);
      pass.setBindGroup(0, bg);
      pass.draw(3);
      pass.end();
    }

    // --- Pass 4: composite (tonemap + gamma) ---
    {
      const bg = device.createBindGroup({
        layout: this.compositePipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: hdrView },
          { binding: 1, resource: blurVView },
          { binding: 2, resource: sampler },
          { binding: 3, resource: { buffer: this.compositeBuf } },
        ],
      });
      const pass = encoder.beginRenderPass({
        colorAttachments: [{ view: outputView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }],
      });
      pass.setPipeline(this.compositePipeline);
      pass.setBindGroup(0, bg);
      pass.draw(3);
      pass.end();
    }
  }

  destroy(): void {
    this.brightTex?.destroy();
    this.blurHTex?.destroy();
    this.blurVTex?.destroy();
    this.thresholdBuf.destroy();
    this.blurHDirBuf.destroy();
    this.blurVDirBuf.destroy();
    this.compositeBuf.destroy();
  }
}
