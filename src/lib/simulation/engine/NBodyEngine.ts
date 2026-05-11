import { NBodyCompute } from '../compute/NBodyCompute.js';
import { ParticleRenderer } from '../render/ParticleRenderer.js';
import { BloomPass } from '../render/BloomPass.js';
import type { Camera } from '../viewport/Camera.js';
import type { BodyData } from '../physics/bodies.js';

export class NBodyEngine {
	private device: GPUDevice;
	private compute: NBodyCompute;
	private particles: ParticleRenderer;
	private bloom: BloomPass;
	private swapChainFormat: GPUTextureFormat = 'bgra8unorm';
	private initialized = false;

	/** Accumulated simulation time in years */
	simulationTime = 0;

	constructor(device: GPUDevice) {
		this.device = device;
		this.compute = new NBodyCompute(device);
		this.particles = new ParticleRenderer(device);
		this.bloom = new BloomPass(device);
	}

	/**
	 * Initialize render pipelines. Must be called once after the canvas context
	 * is configured so the swap-chain format is known.
	 */
	async initRender(context: GPUCanvasContext): Promise<void> {
		this.swapChainFormat = navigator.gpu.getPreferredCanvasFormat();
		context.configure({ device: this.device, format: this.swapChainFormat, alphaMode: 'opaque' });

		await this.particles.init();
		await this.bloom.init(this.swapChainFormat);

		// Bind compute output buffers to the particle renderer
		this.particles.bindBodyBuffers(this.compute.outputBuffer, this.compute.propsBuffer);
		this.initialized = true;
	}

	/** Call whenever the canvas is resized. */
	resize(width: number, height: number): void {
		this.particles.resize(width, height);
		this.bloom.resize(width, height);
	}

	loadBodies(bodies: BodyData[]): void {
		this.compute.upload(bodies);
		// Rebind buffers after upload (upload may have recreated them)
		this.particles.bindBodyBuffers(this.compute.outputBuffer, this.compute.propsBuffer);
		this.simulationTime = 0;
	}

	/** Advance simulation by dt years. */
	step(dt: number): void {
		const encoder = this.device.createCommandEncoder({ label: 'nbody-step' });
		this.compute.step(encoder, dt);
		this.device.queue.submit([encoder.finish()]);
		this.simulationTime += dt;
		// After step, rebind the new output buffer (ping-pong swapped)
		this.particles.bindBodyBuffers(this.compute.outputBuffer, this.compute.propsBuffer);
	}

	/** Render one frame. Requires initRender() to have been called first. */
	render(context: GPUCanvasContext, camera: Camera): void {
		if (!this.initialized) return;

		const viewProj = camera.buildViewProjMatrix();
		this.particles.uploadCamera(viewProj, camera.pixelsPerAU);

		const encoder = this.device.createCommandEncoder({ label: 'nbody-render' });

		// Particle pass → HDR texture
		this.particles.render(encoder, this.compute.bodyCount);

		const hdrTex = this.particles.hdrGPUTexture;
		if (!hdrTex) return;

		// Bloom passes → swap chain
		const outputView = context.getCurrentTexture().createView();
		this.bloom.render(encoder, hdrTex, outputView);

		this.device.queue.submit([encoder.finish()]);
	}

	get posVelBuffer(): GPUBuffer {
		return this.compute.outputBuffer;
	}

	get bodyCount(): number {
		return this.compute.bodyCount;
	}

	destroy(): void {
		this.compute.destroy();
		this.particles.destroy();
		this.bloom.destroy();
	}
}
