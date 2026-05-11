import { BodyType, type BodyData } from '../physics/bodies.js';
import { units } from '../physics/units.js';

/**
 * Binary star system: two equal-mass stars in a circular mutual orbit,
 * with a small planet orbiting the centre of mass.
 *
 * For two equal masses M each separated by 2a:
 *   Orbital speed of each star: v = π * a / T, where T = keplerPeriod(a, 2M)
 *   Stars orbit the COM at radius a.
 */
export function binaryStars(): BodyData[] {
	const STAR_MASS  = 0.8;   // M☉ each
	const SEPARATION = 1.5;   // AU between stars (radius = 0.75 AU each)
	const a = SEPARATION / 2; // each star's orbital radius

	// Circular speed of each star around COM
	// ω² * a = G * (2M) / (2a)² → v = sqrt(G*M / (2a))
	const vStar = Math.sqrt((4 * Math.PI * Math.PI * STAR_MASS) / (2 * SEPARATION));

	// Planet orbiting the COM at 3 AU (well outside the binary)
	const planetA = 3.0;
	const vPlanet = units.circularOrbitSpeed(2 * STAR_MASS, planetA);

	return [
		{
			name: 'Star A', x: -a, y: 0, vx: 0, vy: -vStar,
			mass: STAR_MASS, radius: 0.004, type: BodyType.STAR, active: 1,
		},
		{
			name: 'Star B', x:  a, y: 0, vx: 0, vy:  vStar,
			mass: STAR_MASS, radius: 0.004, type: BodyType.STAR, active: 1,
		},
		{
			name: 'Circumbinary Planet',
			x: planetA, y: 0, vx: 0, vy: vPlanet,
			mass: 3e-6, radius: 0.0006, type: BodyType.PLANET, active: 1,
		},
	];
}
