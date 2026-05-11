import { describe, it, expect } from 'vitest';
import { mergeBodies, findCollisions } from './merger.js';
import { BodyType, type BodyData } from './bodies.js';

const mkBody = (overrides: Partial<BodyData>): BodyData => ({
	x: 0, y: 0, vx: 0, vy: 0,
	mass: 1e-6, radius: 0.001,
	type: BodyType.PLANET, active: 1,
	...overrides,
});

describe('mergeBodies', () => {
	it('conserves total mass', () => {
		const a = mkBody({ mass: 2e-6 });
		const b = mkBody({ mass: 3e-6 });
		const result = mergeBodies([a, b], 0, 1);
		expect(result[0].mass).toBeCloseTo(5e-6);
	});

	it('conserves momentum', () => {
		const a = mkBody({ mass: 1e-6, vx: 4, vy: 0 });
		const b = mkBody({ mass: 1e-6, vx: 0, vy: 2 });
		const result = mergeBodies([a, b], 0, 1);
		expect(result[0].vx).toBeCloseTo(2);   // (1×4 + 1×0) / 2
		expect(result[0].vy).toBeCloseTo(1);   // (1×0 + 1×2) / 2
	});

	it('flags consumed body as inactive', () => {
		const a = mkBody({ mass: 2e-6 });
		const b = mkBody({ mass: 1e-6 });
		const result = mergeBodies([a, b], 0, 1);
		expect(result[1].active).toBe(0);
	});

	it('does not mutate input array', () => {
		const a = mkBody({});
		const b = mkBody({});
		const original = [a, b];
		mergeBodies(original, 0, 1);
		expect(original[0]).toBe(a);
	});
});

describe('findCollisions', () => {
	it('detects overlapping bodies', () => {
		const a = mkBody({ x: 0, radius: 0.01 });
		const b = mkBody({ x: 0.005, radius: 0.01 }); // overlapping
		const pairs = findCollisions([a, b]);
		expect(pairs).toHaveLength(1);
		expect(pairs[0]).toEqual([0, 1]);
	});

	it('ignores separated bodies', () => {
		const a = mkBody({ x: 0,   radius: 0.001 });
		const b = mkBody({ x: 1.0, radius: 0.001 });
		expect(findCollisions([a, b])).toHaveLength(0);
	});

	it('ignores inactive bodies', () => {
		const a = mkBody({ x: 0, radius: 0.01, active: 0 });
		const b = mkBody({ x: 0, radius: 0.01 });
		expect(findCollisions([a, b])).toHaveLength(0);
	});
});
