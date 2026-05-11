<script lang="ts">
	import { onMount } from 'svelte';
	import { initWebGPU, isWebGPUAvailable } from '$lib/simulation/engine/WebGPUDevice.js';
	import { NBodyEngine } from '$lib/simulation/engine/NBodyEngine.js';
	import { Camera } from '$lib/simulation/viewport/Camera.js';
	import { buildControls } from '$lib/simulation/viewport/controls.js';
	import { BodyType, type BodyData } from '$lib/simulation/physics/bodies.js';
	import { eulerStep, render2D, MAX_CPU_BODIES } from '$lib/simulation/fallback/canvas2d.js';
	import { simulation } from '$lib/stores/simulation.svelte.js';

	// ---------------------------------------------------------------------------
	// Props
	// ---------------------------------------------------------------------------
	let {
		onSpawnBody,
	}: {
		/** Called when the user spawns a new body via SpawnPanel or canvas click. */
		onSpawnBody?: (body: BodyData) => void;
	} = $props();

	// ---------------------------------------------------------------------------
	// State
	// ---------------------------------------------------------------------------
	let canvas = $state<HTMLCanvasElement | null>(null);
	let statusMessage = $state('Initializing WebGPU…');
	/** Canvas2D fallback body state — only non-null when GPU unavailable */
	let fallbackBodies = $state<BodyData[] | null>(null);
	let fallbackCanvas = $state<HTMLCanvasElement | null>(null);

	// ---------------------------------------------------------------------------
	// Camera + controls
	// ---------------------------------------------------------------------------
	const camera = new Camera({ pixelsPerAU: 120 });

	// Controls are initialized once; re-use the same object across renders
	const controls = buildControls(camera, (_sx, _sy) => {
		// TODO Phase 4: find nearest body to click via CPU snapshot
	});

	// ---------------------------------------------------------------------------
	// Engine ref — exposed so the parent page can call spawnBody()
	// ---------------------------------------------------------------------------
	let engine: NBodyEngine | null = null;

	/** Add a body to the running simulation (respects maxBodies limit). */
	export function spawnBody(body: BodyData): void {
		if (simulation.bodyCount >= simulation.maxBodies) return;
		if (engine) {
			const next: BodyData[] = [...simulation.bodies, body];
			engine.loadBodies(next);
			simulation.bodies    = next;
			simulation.bodyCount = engine.bodyCount;
		} else if (fallbackBodies) {
			// Canvas2D fallback path
			if (fallbackBodies.length < MAX_CPU_BODIES) {
				fallbackBodies = [...fallbackBodies, body];
				simulation.bodies    = fallbackBodies;
				simulation.bodyCount = fallbackBodies.filter((b) => b.active).length;
			}
		}
		onSpawnBody?.(body);
	}

	/** Load a completely new set of bodies (used by preset loader). */
	export function loadPreset(bodies: BodyData[]): void {
		if (engine) {
			engine.loadBodies(bodies);
			simulation.bodies    = bodies;
			simulation.bodyCount = engine.bodyCount;
			simulation.simYears  = 0;
		} else if (fallbackBodies !== null) {
			// Canvas2D fallback path
			fallbackBodies       = bodies.slice(0, MAX_CPU_BODIES);
			simulation.bodies    = fallbackBodies;
			simulation.bodyCount = fallbackBodies.filter((b) => b.active).length;
			simulation.simYears  = 0;
		}
	}

	// ---------------------------------------------------------------------------
	// Engine lifecycle
	// ---------------------------------------------------------------------------
	onMount(() => {
		if (!canvas) return;

		let rafId = 0;
		let lastTime = 0;
		let frameCount = 0;
		let fpsTimer = 0;
		let destroyed = false;

		const DT_YEAR = 1 / 365.25;

		async function start() {
			statusMessage = 'Requesting GPU adapter…';
			const result = await initWebGPU();
			if (!isWebGPUAvailable(result)) {
				simulation.gpuError = result.reason;
				statusMessage = '';  // clear spinner, show fallback UI

				// Start Canvas2D fallback
				const initial = defaultBodies().slice(0, MAX_CPU_BODIES);
				fallbackBodies       = initial;
				simulation.bodies    = initial;
				simulation.bodyCount = initial.filter((b) => b.active).length;

				let fbSimYears = 0;

				function fallbackLoop(time: number) {
					if (destroyed) return;
					rafId = requestAnimationFrame(fallbackLoop);

					const elapsed = Math.min((time - lastTime) / 1000, 0.05);
					lastTime = time;

					frameCount++;
					fpsTimer += elapsed;
					if (fpsTimer >= 1) {
						simulation.fps = Math.round(frameCount / fpsTimer);
						frameCount = 0;
						fpsTimer   = 0;
					}

					if (!simulation.paused && fallbackBodies) {
						const dtYr = DT_YEAR * simulation.timeScale;
						eulerStep(fallbackBodies, dtYr);
						fbSimYears += dtYr;
						simulation.simYears  = fbSimYears;
						simulation.bodyCount = fallbackBodies.filter((b) => b.active).length;
					}

					if (fallbackCanvas && fallbackBodies) {
						const ctx2d = fallbackCanvas.getContext('2d');
						if (ctx2d) {
							const cs    = camera.state;
							const cx    = fallbackCanvas.width  / 2 - cs.centerX * cs.pixelsPerAU;
							const cy    = fallbackCanvas.height / 2 + cs.centerY * cs.pixelsPerAU;
							render2D(ctx2d, fallbackBodies, cs.pixelsPerAU, cx, cy);
						}
					}
				}

				lastTime = performance.now();
				rafId = requestAnimationFrame(fallbackLoop);

				// Size the 2D canvas to fill its container
				// fallbackCanvas is bound reactively, so we wait one tick
				const sizeCanvas = () => {
					if (!fallbackCanvas) return;
					const rect = fallbackCanvas.getBoundingClientRect();
					fallbackCanvas.width  = Math.round(rect.width  * devicePixelRatio);
					fallbackCanvas.height = Math.round(rect.height * devicePixelRatio);
					camera.setViewport(fallbackCanvas.width, fallbackCanvas.height);
				};
				// Use a short timeout to let Svelte render the fallback canvas
				setTimeout(sizeCanvas, 0);

				const fbRo = new ResizeObserver((entries) => {
					if (destroyed || !fallbackCanvas) return;
					const entry = entries[0];
					fallbackCanvas.width  = Math.round(entry.contentRect.width  * devicePixelRatio);
					fallbackCanvas.height = Math.round(entry.contentRect.height * devicePixelRatio);
					camera.setViewport(fallbackCanvas.width, fallbackCanvas.height);
				});
				// Observe the parent element (not the canvas itself, which doesn't exist yet)
				if (canvas) fbRo.observe(canvas.parentElement ?? canvas);

				return;
			}

			engine = new NBodyEngine(result.device);
			statusMessage = 'Initializing render pipeline…';

			const context = canvas!.getContext('webgpu') as GPUCanvasContext | null;
			if (!context) {
				simulation.gpuError = 'Could not get WebGPU canvas context.';
				statusMessage = simulation.gpuError;
				return;
			}

			statusMessage = 'Compiling shaders…';
			await engine.initRender(context);

			const { width, height } = canvas!.getBoundingClientRect();
			canvas!.width  = width  * devicePixelRatio;
			canvas!.height = height * devicePixelRatio;
			camera.setViewport(canvas!.width, canvas!.height);
			engine.resize(canvas!.width, canvas!.height);

			const initial = defaultBodies();
			engine.loadBodies(initial);
			simulation.bodies    = initial;
			simulation.bodyCount = engine.bodyCount;
			statusMessage = '';

			const ro = new ResizeObserver((entries) => {
				if (destroyed) return;
				const entry = entries[0];
				const w = Math.round(entry.contentRect.width  * devicePixelRatio);
				const h = Math.round(entry.contentRect.height * devicePixelRatio);
				canvas!.width  = w;
				canvas!.height = h;
				camera.setViewport(w, h);
				engine?.resize(w, h);
			});
			ro.observe(canvas!);

			function loop(time: number) {
				if (destroyed) return;
				rafId = requestAnimationFrame(loop);

				const dt = Math.min((time - lastTime) / 1000, 0.05);
				lastTime = time;

				frameCount++;
				fpsTimer += dt;
				if (fpsTimer >= 1) {
					simulation.fps = Math.round(frameCount / fpsTimer);
					frameCount = 0;
					fpsTimer   = 0;
				}

					// Sync trail toggle from store
				if (engine) engine.trailsEnabled = simulation.trailsEnabled;

				if (!simulation.paused && engine) {
					engine.step(DT_YEAR * simulation.timeScale, simulation.bodies);
					simulation.simYears = engine.simulationTime;
				}

				if (engine && context) {
					engine.render(context, camera, simulation.bodies);
				}
			}

			lastTime = performance.now();
			rafId = requestAnimationFrame(loop);

			return () => {
				destroyed = true;
				cancelAnimationFrame(rafId);
				ro.disconnect();
				engine?.destroy();
				engine = null;
			};
		}

		const cleanup = start().catch((err: unknown) => {
			const msg = err instanceof Error ? err.message : String(err);
			console.error('Simulation init failed:', err);
			statusMessage = `Init error: ${msg}`;
		});
		return () => {
			destroyed = true;
			cancelAnimationFrame(rafId);
			cleanup.then((fn) => typeof fn === 'function' && fn());
		};
	});

	// ---------------------------------------------------------------------------
	// Default scene: Sun + 4 planets
	// ---------------------------------------------------------------------------
	function defaultBodies(): BodyData[] {
		return [
			{ name: 'Sun',     x: 0,    y: 0, vx: 0, vy: 0,      mass: 1.0,     radius: 0.005,  type: BodyType.STAR,   active: 1 },
			{ name: 'Mercury', x: 0.39, y: 0, vx: 0, vy: 10.07,  mass: 1.65e-7, radius: 0.0002, type: BodyType.PLANET, active: 1 },
			{ name: 'Venus',   x: 0.72, y: 0, vx: 0, vy: 7.39,   mass: 2.44e-6, radius: 0.0005, type: BodyType.PLANET, active: 1 },
			{ name: 'Earth',   x: 1.0,  y: 0, vx: 0, vy: 6.2832, mass: 3.0e-6,  radius: 0.0005, type: BodyType.PLANET, active: 1 },
			{ name: 'Mars',    x: 1.52, y: 0, vx: 0, vy: 5.09,   mass: 3.2e-7,  radius: 0.0003, type: BodyType.PLANET, active: 1 },
		];
	}
</script>

<!-- Status overlay: loading spinner -->
{#if statusMessage}
	<div
		class="absolute inset-0 flex items-center justify-center bg-black/90 text-white text-sm px-4 text-center"
		role="status"
		aria-live="polite"
	>
		<p>{statusMessage}</p>
	</div>
{/if}

<!-- WebGPU canvas (primary) — hidden when in fallback mode -->
<canvas
	bind:this={canvas}
	class="w-full h-full block"
	class:hidden={!!simulation.gpuError}
	aria-label="2D gravity simulation — drag to pan, scroll to zoom, arrow keys to navigate"
	tabindex="0"
	onpointerdown={controls.onpointerdown}
	onpointermove={controls.onpointermove}
	onpointerup={controls.onpointerup}
	onwheel={controls.onwheel}
	onkeydown={controls.onkeydown}
></canvas>

<!-- Canvas2D fallback — shown when WebGPU is unavailable -->
{#if simulation.gpuError}
	<div class="absolute top-8 left-0 right-0 flex items-center justify-center
	            py-1 bg-yellow-900/80 text-yellow-200 text-xs font-mono z-20">
		Canvas 2D mode (WebGPU unavailable — max {MAX_CPU_BODIES} bodies)
	</div>
	<canvas
		bind:this={fallbackCanvas}
		class="w-full h-full block"
		aria-label="2D gravity simulation — Canvas 2D fallback mode"
		tabindex="0"
		onpointerdown={controls.onpointerdown}
		onpointermove={controls.onpointermove}
		onpointerup={controls.onpointerup}
		onwheel={controls.onwheel}
		onkeydown={controls.onkeydown}
	></canvas>
{/if}

<style>
	canvas {
		cursor: grab;
		touch-action: none; /* prevent browser scroll/zoom interfering */
		outline: none;
	}
	canvas:active {
		cursor: grabbing;
	}
</style>
