/**
 * Simulation unit system: AU, solar masses (M☉), years (yr)
 *
 * In these units G = 4π², which keeps float32 values in [1e-3, 1e3]
 * and avoids precision loss that would occur with SI units at astronomical scales.
 *
 * Conversions:
 *   1 AU  = 1.496e11 m
 *   1 M☉  = 1.989e30 kg
 *   1 yr  = 3.156e7 s
 *   G_sim = 4π² AU³ / (M☉ · yr²)
 */

export const G_SIM = 4 * Math.PI * Math.PI; // AU³ / (M☉ · yr²)

// SI conversion factors
const AU_TO_M = 1.496e11;
const MSUN_TO_KG = 1.989e30;
const YR_TO_S = 3.156e7;

export const units = {
	/** Convert metres to AU */
	mToAU: (m: number): number => m / AU_TO_M,
	/** Convert AU to metres */
	auToM: (au: number): number => au * AU_TO_M,

	/** Convert kg to solar masses */
	kgToMsun: (kg: number): number => kg / MSUN_TO_KG,
	/** Convert solar masses to kg */
	msunToKg: (msun: number): number => msun * MSUN_TO_KG,

	/** Convert seconds to years */
	sToYr: (s: number): number => s / YR_TO_S,
	/** Convert years to seconds */
	yrToS: (yr: number): number => yr * YR_TO_S,

	/** Convert m/s to AU/yr */
	msToAUyr: (ms: number): number => (ms / AU_TO_M) * YR_TO_S,
	/** Convert AU/yr to m/s */
	auyrToMs: (auyr: number): number => (auyr * AU_TO_M) / YR_TO_S,

	/**
	 * Circular orbital speed in AU/yr for a body orbiting a central mass.
	 * v = sqrt(G * M / r)
	 */
	circularOrbitSpeed: (centralMassMsun: number, radiusAU: number): number =>
		Math.sqrt((G_SIM * centralMassMsun) / radiusAU),

	/**
	 * Orbital period in years via Kepler's third law.
	 * T = 2π * sqrt(a³ / (G * M))
	 */
	keplerPeriod: (semiMajorAxisAU: number, centralMassMsun: number): number =>
		2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxisAU, 3) / (G_SIM * centralMassMsun))
} as const;
