import { describe, it, expect } from 'vitest';
import { eulerStep, MAX_CPU_BODIES } from './canvas2d.js';
import { BodyType, type BodyData } from '../physics/bodies.js';

const mkBody = (overrides: Partial<BodyData>): BodyData => ({
	x: 0, y: 0, vx: 0, vy: 0,
	mass: 1, radius: 0.001,
	type: BodyType.STAR, active: 1,
	...overrides,
});

describe('eulerStep', () => {
	it('does not mutate inactive bodies', () => {
		const body = mkBody({ x: 1, y: 1, active: 0 });
		eulerStep([body], 1 / 365.25);
		expect(body.x).toBe(1);
		expect(body.y).toBe(1);
	});

	it('moves a body toward a massive attractor', () => {
		// Star at origin, small planet at (1 AU, 0)
		const star   = mkBody({ mass: 1.0, x: 0, y: 0, radius: 0.005 });
		const planet = mkBody({ mass: 1e-6, x: 1, y: 0, radius: 0.0005 });
		eulerStep([star, planet], 1 / 365.25);
		// Planet should accelerate toward origin — vx becomes negative
		expect(planet.vx).toBeLessThan(0);
		expect(planet.x).toBeLessThan(1);
	});

	it('conserves momentum (symmetric two-body)', () => {
		const a = mkBody({ mass: 1, x: -1, y: 0 });
		const b = mkBody({ mass: 1, x:  1, y: 0 });
		const pxBefore = a.mass * a.vx + b.mass * b.vx;
		const pyBefore = a.mass * a.vy + b.mass * b.vy;
		eulerStep([a, b], 0.01);
		const pxAfter = a.mass * a.vx + b.mass * b.vx;
		const pyAfter = a.mass * a.vy + b.mass * b.vy;
		expect(pxAfter).toBeCloseTo(pxBefore, 10);
		expect(pyAfter).toBeCloseTo(pyBefore, 10);
	});

	it('MAX_CPU_BODIES is 64', () => {
		expect(MAX_CPU_BODIES).toBe(64);
	});
});
