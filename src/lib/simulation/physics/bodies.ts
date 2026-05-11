/** Celestial body types — stored as f32 in GPU buffers (0,1,2,3) */
export enum BodyType {
	STAR = 0,
	PLANET = 1,
	ASTEROID = 2,
	BLACK_HOLE = 3
}

/**
 * CPU-side representation of a simulated body.
 * Coordinates in AU, velocities in AU/yr, mass in M☉, radius in AU.
 */
export interface BodyData {
	x: number;
	y: number;
	vx: number;
	vy: number;
	/** Solar masses (M☉) */
	mass: number;
	/** Astronomical units (AU) */
	radius: number;
	type: BodyType;
	/** 1 = alive, 0 = merged/deleted — skipped in compute shader */
	active: 1 | 0;
	/** Optional display label */
	name?: string;
}

/** GPU buffer stride: 4 × f32 per body for the position/velocity buffer */
export const BODY_STRIDE_POSVEL = 4; // x, y, vx, vy
/** GPU buffer stride: 4 × f32 per body for the properties buffer */
export const BODY_STRIDE_PROPS = 4; // mass, radius, type, active

/** Maximum bodies supported in GPU buffers (must match nbody.wgsl constant) */
export const MAX_BODIES = 16384;

/** Workgroup size — must match @workgroup_size in nbody.wgsl */
export const WORKGROUP_SIZE = 256;

/**
 * Encode an array of BodyData into two flat Float32Arrays suitable for GPU upload.
 * posVelData: [ x, y, vx, vy, ... ] × N
 * propsData:  [ mass, radius, type, active, ... ] × N
 */
export function encodeBodies(bodies: BodyData[]): {
	posVelData: Float32Array;
	propsData: Float32Array;
} {
	const n = bodies.length;
	const posVelData = new Float32Array(n * BODY_STRIDE_POSVEL);
	const propsData = new Float32Array(n * BODY_STRIDE_PROPS);

	for (let i = 0; i < n; i++) {
		const b = bodies[i];
		const pv = i * BODY_STRIDE_POSVEL;
		posVelData[pv + 0] = b.x;
		posVelData[pv + 1] = b.y;
		posVelData[pv + 2] = b.vx;
		posVelData[pv + 3] = b.vy;

		const pr = i * BODY_STRIDE_PROPS;
		propsData[pr + 0] = b.mass;
		propsData[pr + 1] = b.radius;
		propsData[pr + 2] = b.type;
		propsData[pr + 3] = b.active;
	}

	return { posVelData, propsData };
}
