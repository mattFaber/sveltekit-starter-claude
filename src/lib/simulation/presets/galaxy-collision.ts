import { BodyType, type BodyData } from '../physics/bodies.js';
import { units } from '../physics/units.js';

/**
 * Two colliding disk galaxies.
 *
 * Each galaxy: 1 massive core + N orbiting bodies in a flat disk.
 * Galaxy A comes from left, galaxy B from right, on a collision course.
 *
 * The disk uses a simple flat distribution where circular speed is derived
 * from the core mass (ignoring disk self-gravity for simplicity).
 */
export function galaxyCollision(nPerGalaxy = 200): BodyData[] {
	const CORE_MASS = 1e6;     // M☉ — supermassive core
	const DISK_BODY_MASS = 10; // M☉ each (stars)
	const DISK_BODY_RADIUS = 0.0005;
	const CORE_RADIUS = 0.05;
	const DISK_INNER = 0.5;   // AU from core
	const DISK_OUTER = 8.0;

	// Initial separation and approach velocity
	const SEP_X = 15;     // AU between cores at t=0
	const APPROACH_VX = -1.2; // AU/yr for each galaxy heading toward COM

	function makeDisk(
		coreX: number,
		coreVX: number,
		coreVY: number,
		n: number,
		seed = 0,
	): BodyData[] {
		const bodies: BodyData[] = [];

		// Core
		bodies.push({
			name: `Core ${seed === 0 ? 'A' : 'B'}`,
			x: coreX, y: 0, vx: coreVX, vy: coreVY,
			mass: CORE_MASS, radius: CORE_RADIUS,
			type: BodyType.BLACK_HOLE, active: 1,
		});

		// Deterministic pseudo-random using a simple LCG
		let r = seed === 0 ? 0x12345678 : 0x87654321;
		function rand(): number {
			r = (Math.imul(1664525, r) + 1013904223) >>> 0;
			return r / 0xffffffff;
		}

		for (let i = 0; i < n; i++) {
			const radius = DISK_INNER + rand() * (DISK_OUTER - DISK_INNER);
			const angle  = rand() * 2 * Math.PI;
			const bx = coreX + Math.cos(angle) * radius;
			const by = Math.sin(angle) * radius;

			// Circular orbit speed around core, plus galaxy bulk motion
			const vorbit = units.circularOrbitSpeed(CORE_MASS, radius);
			// Tangential direction: perpendicular to radial
			const vx = coreVX + (-Math.sin(angle)) * vorbit;
			const vy = coreVY + ( Math.cos(angle)) * vorbit;

			bodies.push({
				name: undefined,
				x: bx, y: by, vx, vy,
				mass: DISK_BODY_MASS, radius: DISK_BODY_RADIUS,
				type: BodyType.STAR, active: 1,
			});
		}

		return bodies;
	}

	const galaxyA = makeDisk( SEP_X,  APPROACH_VX, 0, nPerGalaxy, 0);
	const galaxyB = makeDisk(-SEP_X, -APPROACH_VX, 0, nPerGalaxy, 1);

	return [...galaxyA, ...galaxyB];
}
