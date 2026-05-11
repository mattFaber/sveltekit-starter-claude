import { NBodyCompute } from '../compute/NBodyCompute.js';
import type { BodyData } from '../physics/bodies.js';

/**
 * NBodyEngine — top-level orchestrator for the simulation loop.
 *
 * Phase 1: compute-only (no rendering yet).
 * Phase 2 will inject a ParticleRenderer + BloomPass.
 *
 * Usage:
 *   const engine = new NBodyEngine(device);
 *   engine.loadBodies(bodies);
 *   // in rAF loop:
 *   engine.step(dt);          // advance physics
 *   engine.render(context);   // draw frame (Phase 2)
 */
export class NBodyEngine {
	private device: GPUDevice;
	private compute: NBodyCompute;

	/** Accumulated simulation time in years */
	simulationTime = 0;

	constructor(device: GPUDevice) {
		this.device = device;
		this.compute = new NBodyCompute(device);
	}

	loadBodies(bodies: BodyData[]): void {
		this.compute.upload(bodies);
		this.simulationTime = 0;
	}

	/**
	 * Advance simulation by dt years.
	 * Encodes a compute pass and submits it to the GPU queue.
	 */
	step(dt: number): void {
		const encoder = this.device.createCommandEncoder({ label: 'nbody-step' });
		this.compute.step(encoder, dt);
		this.device.queue.submit([encoder.finish()]);
		this.simulationTime += dt;
	}

	/**
	 * Render the current frame onto the provided canvas context.
	 * Phase 1 stub — Phase 2 will implement full ParticleRenderer + Bloom.
	 */
	render(_context: GPUCanvasContext): void {
		// Placeholder: clear to black
		const encoder = this.device.createCommandEncoder({ label: 'render-stub' });
		const textureView = _context.getCurrentTexture().createView();
		const pass = encoder.beginRenderPass({
			colorAttachments: [
				{
					view: textureView,
					clearValue: { r: 0, g: 0, b: 0.02, a: 1 },
					loadOp: 'clear',
					storeOp: 'store'
				}
			]
		});
		pass.end();
		this.device.queue.submit([encoder.finish()]);
	}

	/** The GPU buffer containing current body positions/velocities (for rendering). */
	get posVelBuffer(): GPUBuffer {
		return this.compute.outputBuffer;
	}

	get bodyCount(): number {
		return this.compute.bodyCount;
	}

	destroy(): void {
		this.compute.destroy();
	}
}
