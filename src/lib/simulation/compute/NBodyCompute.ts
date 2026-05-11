import { NBODY_SHADER } from './nbody.wgsl.js';
import { MAX_BODIES, WORKGROUP_SIZE, encodeBodies, type BodyData } from '../physics/bodies.js';

/** Byte sizes */
const F32 = 4;
const VEC4_BYTES = 4 * F32;

/** Params uniform layout: n_bodies(u32) + dt(f32) + 2× padding */
const PARAMS_BYTES = 4 * F32;

export class NBodyCompute {
	private device: GPUDevice;
	private pipeline!: GPUComputePipeline;

	/** Ping-pong position+velocity buffers */
	private posVelBuf: [GPUBuffer, GPUBuffer];
	/** Properties buffer: mass, radius, type, active */
	private propsBuf: GPUBuffer;
	/** Uniform params buffer */
	private paramsBuf: GPUBuffer;

	/** Which ping-pong buffer is the current OUTPUT */
	private pingPong = 0;

	/** Bind groups for each ping-pong direction */
	private bindGroups!: [GPUBindGroup, GPUBindGroup];

	private nBodies = 0;

	constructor(device: GPUDevice) {
		this.device = device;

		const posVelSize = MAX_BODIES * VEC4_BYTES;
		const propsSize = MAX_BODIES * VEC4_BYTES;

		this.posVelBuf = [
			device.createBuffer({
				label: 'posVel-A',
				size: posVelSize,
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
			}),
			device.createBuffer({
				label: 'posVel-B',
				size: posVelSize,
				usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
			})
		];

		this.propsBuf = device.createBuffer({
			label: 'props',
			size: propsSize,
			usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
		});

		this.paramsBuf = device.createBuffer({
			label: 'simParams',
			size: PARAMS_BYTES,
			usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
		});

		this.buildPipeline();
	}

	private buildPipeline(): void {
		const { device } = this;

		const shaderModule = device.createShaderModule({
			label: 'nbody-compute',
			code: NBODY_SHADER
		});

		const bgl = device.createBindGroupLayout({
			label: 'nbody-bgl',
			entries: [
				{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
				{ binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
				{ binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
				{ binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }
			]
		});

		this.pipeline = device.createComputePipeline({
			label: 'nbody-pipeline',
			layout: device.createPipelineLayout({ bindGroupLayouts: [bgl] }),
			compute: { module: shaderModule, entryPoint: 'main' }
		});

		// Build bind groups for both ping-pong directions
		const makeBindGroup = (readIdx: number, writeIdx: number): GPUBindGroup =>
			device.createBindGroup({
				label: `nbody-bg-${readIdx}->${writeIdx}`,
				layout: bgl,
				entries: [
					{ binding: 0, resource: { buffer: this.posVelBuf[readIdx] } },
					{ binding: 1, resource: { buffer: this.posVelBuf[writeIdx] } },
					{ binding: 2, resource: { buffer: this.propsBuf } },
					{ binding: 3, resource: { buffer: this.paramsBuf } }
				]
			});

		this.bindGroups = [makeBindGroup(0, 1), makeBindGroup(1, 0)];
	}

	/** Upload bodies to GPU and reset ping-pong state. */
	upload(bodies: BodyData[]): void {
		this.nBodies = Math.min(bodies.length, MAX_BODIES);
		const { posVelData, propsData } = encodeBodies(bodies.slice(0, this.nBodies));

		this.device.queue.writeBuffer(this.posVelBuf[0], 0, posVelData);
		this.device.queue.writeBuffer(this.posVelBuf[1], 0, posVelData);
		this.device.queue.writeBuffer(this.propsBuf, 0, propsData);
		this.pingPong = 0;
	}

	/** Run one integration step. */
	step(encoder: GPUCommandEncoder, dt: number): void {
		if (this.nBodies === 0) return;

		// Write uniform params
		const paramsData = new ArrayBuffer(PARAMS_BYTES);
		const view = new DataView(paramsData);
		view.setUint32(0, this.nBodies, true);
		view.setFloat32(4, dt, true);
		this.device.queue.writeBuffer(this.paramsBuf, 0, paramsData);

		const readIdx = this.pingPong;
		const writeIdx = 1 - this.pingPong;

		const pass = encoder.beginComputePass({ label: 'nbody-pass' });
		pass.setPipeline(this.pipeline);
		pass.setBindGroup(0, this.bindGroups[readIdx]);
		pass.dispatchWorkgroups(Math.ceil(this.nBodies / WORKGROUP_SIZE));
		pass.end();

		this.pingPong = writeIdx;
	}

	/** The GPU buffer holding the latest output positions+velocities. */
	get outputBuffer(): GPUBuffer {
		return this.posVelBuf[this.pingPong];
	}

	/** The props buffer (mass, radius, type, active) — read by particle renderer. */
	get propsBuffer(): GPUBuffer {
		return this.propsBuf;
	}

	get bodyCount(): number {
		return this.nBodies;
	}

	destroy(): void {
		this.posVelBuf[0].destroy();
		this.posVelBuf[1].destroy();
		this.propsBuf.destroy();
		this.paramsBuf.destroy();
	}
}
