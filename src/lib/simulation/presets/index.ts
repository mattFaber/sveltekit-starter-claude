import { solarSystem } from './solar-system.js';
import { binaryStars } from './binary-stars.js';
import { galaxyCollision } from './galaxy-collision.js';
import type { BodyData } from '../physics/bodies.js';

export interface Preset {
	id: string;
	label: string;
	description: string;
	/** Default camera pixelsPerAU for this preset */
	defaultZoom: number;
	build: () => BodyData[];
}

export const PRESETS: Preset[] = [
	{
		id: 'solar-system',
		label: 'Solar System',
		description: 'Sun + 8 planets in circular orbits',
		defaultZoom: 25,
		build: solarSystem,
	},
	{
		id: 'binary-stars',
		label: 'Binary Stars',
		description: 'Two stars in mutual orbit with a circumbinary planet',
		defaultZoom: 80,
		build: binaryStars,
	},
	{
		id: 'galaxy-collision',
		label: 'Galaxy Collision',
		description: 'Two disk galaxies on a collision course (400 bodies)',
		defaultZoom: 5,
		build: () => galaxyCollision(200),
	},
];

export { solarSystem, binaryStars, galaxyCollision };
