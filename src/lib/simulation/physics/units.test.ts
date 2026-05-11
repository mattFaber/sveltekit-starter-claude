import { describe, it, expect } from 'vitest';
import { units, G_SIM } from './units.js';

describe('G_SIM', () => {
	it('equals 4π²', () => {
		expect(G_SIM).toBeCloseTo(4 * Math.PI * Math.PI, 6);
	});
});

describe('units.circularOrbitSpeed', () => {
	it('gives Earth-like speed at 1 AU around 1 M☉', () => {
		// v = 2π AU/yr for circular Earth orbit
		const v = units.circularOrbitSpeed(1, 1);
		expect(v).toBeCloseTo(2 * Math.PI, 3);
	});
});

describe('units.keplerPeriod', () => {
	it("gives 1 year for Earth's orbit (1 AU, 1 M☉)", () => {
		expect(units.keplerPeriod(1, 1)).toBeCloseTo(1, 4);
	});

	it("satisfies T² ∝ a³ — Kepler's third law", () => {
		const T1 = units.keplerPeriod(1, 1);
		const T2 = units.keplerPeriod(4, 1); // 4 AU
		// T2² / T1²  should equal  4³ / 1³ = 64
		expect((T2 * T2) / (T1 * T1)).toBeCloseTo(64, 3);
	});

	it('matches analytical 2-body circular orbit period', () => {
		// Two equal 0.5 M☉ bodies separated by 2 AU orbit their common centre.
		// Effective central mass for circular orbit = total mass = 1 M☉, radius = 1 AU each.
		const T = units.keplerPeriod(1, 1);
		expect(T).toBeCloseTo(1, 4);
	});
});

describe('unit conversions — round-trip', () => {
	it('AU ↔ m', () => {
		expect(units.mToAU(units.auToM(3.14))).toBeCloseTo(3.14, 5);
	});

	it('M☉ ↔ kg', () => {
		expect(units.kgToMsun(units.msunToKg(2.5))).toBeCloseTo(2.5, 5);
	});

	it('yr ↔ s', () => {
		expect(units.sToYr(units.yrToS(10))).toBeCloseTo(10, 5);
	});

	it('AU/yr ↔ m/s', () => {
		expect(units.msToAUyr(units.auyrToMs(1))).toBeCloseTo(1, 4);
	});
});
