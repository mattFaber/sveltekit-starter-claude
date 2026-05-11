import { describe, it, expect } from 'vitest';
import { BodyType, encodeBodies, BODY_STRIDE_POSVEL, BODY_STRIDE_PROPS, type BodyData } from './bodies.js';

const makePlanet = (overrides: Partial<BodyData> = {}): BodyData => ({
	x: 1,
	y: 0,
	vx: 0,
	vy: 6.283,
	mass: 3e-6,
	radius: 4.26e-5,
	type: BodyType.PLANET,
	active: 1,
	...overrides
});

describe('encodeBodies', () => {
	it('encodes position and velocity into posVelData', () => {
		const body = makePlanet({ x: 2, y: 3, vx: -1, vy: 0.5 });
		const { posVelData } = encodeBodies([body]);
		expect(posVelData[0]).toBe(2);
		expect(posVelData[1]).toBe(3);
		expect(posVelData[2]).toBe(-1);
		expect(posVelData[3]).toBe(0.5);
	});

	it('encodes mass, radius, type, active into propsData', () => {
		const body = makePlanet({ mass: 0.001, radius: 0.01, type: BodyType.STAR, active: 1 });
		const { propsData } = encodeBodies([body]);
		expect(propsData[0]).toBeCloseTo(0.001, 6);
		expect(propsData[1]).toBeCloseTo(0.01, 6);
		expect(propsData[2]).toBe(BodyType.STAR);
		expect(propsData[3]).toBe(1);
	});

	it('encodes multiple bodies with correct stride', () => {
		const bodies = [makePlanet({ x: 1 }), makePlanet({ x: 5 })];
		const { posVelData } = encodeBodies(bodies);
		expect(posVelData[0 * BODY_STRIDE_POSVEL]).toBe(1);
		expect(posVelData[1 * BODY_STRIDE_POSVEL]).toBe(5);
	});

	it('marks inactive bodies with active=0 in propsData', () => {
		const body = makePlanet({ active: 0 });
		const { propsData } = encodeBodies([body]);
		expect(propsData[BODY_STRIDE_PROPS - 1]).toBe(0);
	});
});
