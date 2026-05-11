import { describe, it, expect } from 'vitest';
import { adaptiveTimestep } from './adaptiveTimestep.js';
import { BodyType, type BodyData } from '../physics/bodies.js';

const mkBody = (overrides: Partial<BodyData>): BodyData => ({
	x: 0, y: 0, vx: 0, vy: 0,
	mass: 1e-6, radius: 0.001,
	type: BodyType.PLANET, active: 1,
	...overrides,
});

const initialState = () => ({ safedt: 1 / 365.25, smootheddt: 1 / 365.25 });

describe('adaptiveTimestep', () => {
	it('returns requestedDt when bodies are slow', () => {
		const body = mkBody({ vx: 1e-8, vy: 0, radius: 1 }); // radius 1 AU, tiny speed → huge safe dt
		const { dt } = adaptiveTimestep([body], 1 / 365.25, initialState());
		expect(dt).toBeCloseTo(1 / 365.25, 6);
	});

	it('clamps dt when a body is extremely fast', () => {
		const requested = 1 / 365.25; // 1 day
		const body = mkBody({ vx: 1000, vy: 0, radius: 0.0001 }); // very fast → tiny safe dt
		const { dt } = adaptiveTimestep([body], requested, initialState());
		expect(dt).toBeLessThan(requested);
	});

	it('skips inactive bodies', () => {
		const fast     = mkBody({ vx: 1000, vy: 0, radius: 0.0001, active: 0 });
		const slow     = mkBody({ vx: 0.1,  vy: 0, radius: 1 });
		const requested = 1 / 365.25;
		const { dt } = adaptiveTimestep([fast, slow], requested, initialState());
		// Fast body is inactive — dt should not be clamped by it
		expect(dt).toBeCloseTo(requested, 5);
	});

	it('never returns dt below MIN_DT', () => {
		const body = mkBody({ vx: 1e9, radius: 1e-20 }); // absurdly fast
		const { dt } = adaptiveTimestep([body], 1 / 365.25, initialState());
		expect(dt).toBeGreaterThanOrEqual(1e-6);
	});

	it('propagates smoothed state across calls', () => {
		const body = mkBody({ vx: 100, radius: 0.001 });
		const s0 = initialState();
		const r1 = adaptiveTimestep([body], 1 / 365.25, s0);
		const r2 = adaptiveTimestep([body], 1 / 365.25, r1.state);
		// Second call should have a different smoothed state
		expect(r2.state.smootheddt).not.toEqual(s0.smootheddt);
	});
});
