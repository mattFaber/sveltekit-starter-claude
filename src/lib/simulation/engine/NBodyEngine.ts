import { NBodyCompute } from '../compute/NBodyCompute.js';
import { ParticleRenderer } from '../render/ParticleRenderer.js';
import { BloomPass } from '../render/BloomPass.js';
import { TrailRenderer } from '../render/TrailRenderer.js';
import { adaptiveTimestep, type AdaptiveState } from './adaptiveTimestep.js';
import { MAX_BODIES } from '../physics/bodies.js';
import type { Camera } from '../viewport/Camera.js';
import type { BodyData } from '../physics/bodies.js';

export class NBodyEngine {
	private device: GPUDevice;
	private compute: NBodyCompute;
	private particles: ParticleRenderer;
	private bloom: BloomPass;
	private trails: TrailRenderer;
	private swapChainFormat: GPUTextureFormat = 'bgra8unorm';
	private initialized = false;

	/** Adaptive timestep state */
	private adaptiveState: AdaptiveState = { safedt: 1 / 365.25, smootheddt: 1 / 365.25 };

	/** Accumulated simulation time in years */
	simulationTime = 0;

	/** Whether trail rendering is active (drives TrailRenderer.enabled) */
	get trailsEnabled(): boolean { return this.trails.enabled; }
	set trailsEnabled(v: boolean) { this.trails.enabled = v; if (!v) this.trails.reset(); }

	constructor(device: GPUDevice) {
		this.device = device;
		this.compute  = new NBodyCompute(device);
		this.particles = new ParticleRenderer(device);
		this.bloom     = new BloomPass(device);
		this.trails    = new TrailRenderer(device, MAX_BODIES);
	}

	async initRender(context: GPUCanvasContext): Promise<void> {
		this.swapChainFormat = navigator.gpu.getPreferredCanvasFormat();
		context.configure({ device: this.device, format: this.swapChainFormat, alphaMode: 'opaque' });

		await this.particles.init();
		await this.bloom.init(this.swapChainFormat);
		await this.trails.init('rgba16float');

		this.particles.bindBodyBuffers(this.compute.outputBuffer, this.compute.propsBuffer);
		this.initialized = true;
	}

	resize(width: number, height: number): void {
		this.particles.resize(width, height);
		this.bloom.resize(width, height);
	}

	loadBodies(bodies: BodyData[]): void {
		this.compute.upload(bodies);
		this.particles.bindBodyBuffers(this.compute.outputBuffer, this.compute.propsBuffer);
		this.trails.reset();
		this.simulationTime = 0;
	}

	/**
	 * Advance simulation by up to `requestedDt` years.
	 * If adaptive timestep is on, may sub-step to stay stable.
	 * @param requestedDt  Desired step size in years (1 day = 1/365.25)
	 * @param bodies       CPU snapshot for adaptive timestep (optional; if omitted, no adaptation)
	 */
	step(requestedDt: number, bodies?: BodyData[]): void {
		let dt = requestedDt;
		if (bodies && bodies.length > 0) {
			const result = adaptiveTimestep(bodies, requestedDt, this.adaptiveState);
			dt = result.dt;
			this.adaptiveState = result.state;
		}

		const encoder = this.device.createCommandEncoder({ label: 'nbody-step' });
		this.compute.step(encoder, dt);
		this.device.queue.submit([encoder.finish()]);
		this.simulationTime += dt;
		this.particles.bindBodyBuffers(this.compute.outputBuffer, this.compute.propsBuffer);
	}

	/** Render one frame. */
	render(context: GPUCanvasContext, camera: Camera, bodies?: BodyData[]): void {
		if (!this.initialized) return;

		const viewProj = camera.buildViewProjMatrix();
		this.particles.uploadCamera(viewProj, camera.pixelsPerAU);

		// Push trail positions from CPU snapshot
		if (bodies) this.trails.pushPositions(bodies);
		this.trails.uploadCamera(viewProj, camera.pixelsPerAU);

		const encoder = this.device.createCommandEncoder({ label: 'nbody-render' });

		// Particle pass → HDR texture
		this.particles.render(encoder, this.compute.bodyCount);

		const hdrTex  = this.particles.hdrGPUTexture;
		const hdrView = this.particles.hdrTextureView;
		if (!hdrTex || !hdrView) return;

		// Trail pass → same HDR texture (additive blend, loadOp: 'load')
		this.trails.render(encoder, hdrView, this.compute.bodyCount);

		// Bloom + tonemap → swap chain
		const outputView = context.getCurrentTexture().createView();
		this.bloom.render(encoder, hdrTex, outputView);

		this.device.queue.submit([encoder.finish()]);
	}

	get posVelBuffer(): GPUBuffer { return this.compute.outputBuffer; }
	get bodyCount(): number       { return this.compute.bodyCount; }

	destroy(): void {
		this.compute.destroy();
		this.particles.destroy();
		this.bloom.destroy();
		this.trails.destroy();
	}
}
