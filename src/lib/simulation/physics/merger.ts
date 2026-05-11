import type { BodyData } from '../physics/bodies.js';

/**
 * Merge two bodies into one via perfectly inelastic collision.
 * The surviving body inherits the combined mass, momentum-conserved velocity,
 * and a radius scaled by volume conservation (r ∝ m^(1/3)).
 *
 * The consumed body is flagged `active: 0` so the WGSL shader skips it.
 *
 * @returns A new array with the merged result; original array is not mutated.
 */
export function mergeBodies(bodies: BodyData[], i: number, j: number): BodyData[] {
	const a = bodies[i];
	const b = bodies[j];

	const totalMass = a.mass + b.mass;
	// Momentum-conserved velocity
	const vx = (a.mass * a.vx + b.mass * b.vx) / totalMass;
	const vy = (a.mass * a.vy + b.mass * b.vy) / totalMass;
	// Centre of mass position
	const x = (a.mass * a.x + b.mass * b.x) / totalMass;
	const y = (a.mass * a.y + b.mass * b.y) / totalMass;
	// Volume-conserved radius: V ∝ r³, so r_new = (r_a³ + r_b³)^(1/3)
	const radius = Math.cbrt(a.radius ** 3 + b.radius ** 3);

	// Survivor body type: the more massive one wins
	const type = a.mass >= b.mass ? a.type : b.type;
	const name = a.mass >= b.mass ? a.name : b.name;

	const result = [...bodies];
	result[i] = { ...a, x, y, vx, vy, mass: totalMass, radius, type, name, active: 1 };
	result[j] = { ...b, active: 0 };
	return result;
}

/**
 * Check all body pairs for collisions (distance < sum of radii).
 * Returns pairs [i, j] that should be merged this step.
 *
 * O(n²) — only called on the CPU snapshot, not every frame.
 */
export function findCollisions(bodies: BodyData[]): [number, number][] {
	const pairs: [number, number][] = [];
	for (let i = 0; i < bodies.length; i++) {
		if (!bodies[i].active) continue;
		for (let j = i + 1; j < bodies.length; j++) {
			if (!bodies[j].active) continue;
			const dx = bodies[i].x - bodies[j].x;
			const dy = bodies[i].y - bodies[j].y;
			const dist2 = dx * dx + dy * dy;
			const rSum = bodies[i].radius + bodies[j].radius;
			if (dist2 < rSum * rSum) {
				pairs.push([i, j]);
			}
		}
	}
	return pairs;
}
