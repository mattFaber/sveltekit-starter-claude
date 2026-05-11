/**
 * Global simulation state — shared across all UI components.
 * Uses Svelte 5 class-based runes pattern (.svelte.ts).
 */

import type { BodyData } from '$lib/simulation/physics/bodies.js';

class SimulationStore {
	paused     = $state(false);
	timeScale  = $state(1);
	fps        = $state(0);
	bodyCount  = $state(0);
	simYears   = $state(0);
	selectedBodyIndex = $state<number | null>(null);
	/** Live body list for BodyInspector (CPU snapshot, updated ~1/s) */
	bodies     = $state<BodyData[]>([]);
	gpuError   = $state('');

	/** Opt-in GPU trail rendering */
	trailsEnabled = $state(false);
	/** Maximum bodies allowed (enforced on spawn) */
	maxBodies  = $state(512);
}

export const simulation = new SimulationStore();
