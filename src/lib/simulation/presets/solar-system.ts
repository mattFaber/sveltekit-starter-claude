import { BodyType, type BodyData } from '../physics/bodies.js';
import { units } from '../physics/units.js';

/**
 * Sun + 8 planets preset.
 * All planets start on the +X axis with circular-orbit velocity in +Y direction.
 * Masses and semi-major axes from IAU data, scaled to M☉ and AU.
 */
export function solarSystem(): BodyData[] {
	const planets: Array<{ name: string; a: number; mass: number; radius: number }> = [
		{ name: 'Mercury', a: 0.387, mass: 1.65e-7,  radius: 0.00024 },
		{ name: 'Venus',   a: 0.723, mass: 2.44e-6,  radius: 0.00061 },
		{ name: 'Earth',   a: 1.000, mass: 3.00e-6,  radius: 0.00064 },
		{ name: 'Mars',    a: 1.524, mass: 3.21e-7,  radius: 0.00034 },
		{ name: 'Jupiter', a: 5.203, mass: 9.55e-4,  radius: 0.00477 },
		{ name: 'Saturn',  a: 9.537, mass: 2.86e-4,  radius: 0.00403 },
		{ name: 'Uranus',  a: 19.19, mass: 4.37e-5,  radius: 0.00171 },
		{ name: 'Neptune', a: 30.07, mass: 5.15e-5,  radius: 0.00166 },
	];

	const bodies: BodyData[] = [
		{
			name: 'Sun', x: 0, y: 0, vx: 0, vy: 0,
			mass: 1.0, radius: 0.00465, type: BodyType.STAR, active: 1,
		},
	];

	for (const p of planets) {
		const vy = units.circularOrbitSpeed(1.0, p.a);
		bodies.push({
			name: p.name,
			x: p.a, y: 0, vx: 0, vy,
			mass: p.mass, radius: p.radius,
			type: BodyType.PLANET, active: 1,
		});
	}

	return bodies;
}
