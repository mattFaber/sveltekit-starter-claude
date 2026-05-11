<script lang="ts">
	import { onMount } from 'svelte';
	import { initWebGPU, isWebGPUAvailable } from '$lib/simulation/engine/WebGPUDevice.js';
	import { NBodyEngine } from '$lib/simulation/engine/NBodyEngine.js';
	import { Camera } from '$lib/simulation/viewport/Camera.js';
	import { BodyType, type BodyData } from '$lib/simulation/physics/bodies.js';

	// ---------------------------------------------------------------------------
	// Props
	// ---------------------------------------------------------------------------
	let {
		paused = false,
		timeScale = 1,
		onBodyCountChange,
		onSimTimeChange,
		onFpsChange,
		onError,
	}: {
		paused?: boolean;
		timeScale?: number;
		onBodyCountChange?: (n: number) => void;
		onSimTimeChange?: (years: number) => void;
		onFpsChange?: (fps: number) => void;
		onError?: (reason: string) => void;
	} = $props();

	// ---------------------------------------------------------------------------
	// State
	// ---------------------------------------------------------------------------
	let canvas = $state<HTMLCanvasElement | null>(null);
	let statusMessage = $state('Initializing WebGPU…');
	let gpuAvailable = $state(true);

	// ---------------------------------------------------------------------------
	// Camera
	// ---------------------------------------------------------------------------
	const camera = new Camera({ pixelsPerAU: 120 });

	// ---------------------------------------------------------------------------
	// Engine lifecycle
	// ---------------------------------------------------------------------------
	onMount(() => {
		if (!canvas) return;

		let engine: NBodyEngine | null = null;
		let rafId = 0;
		let lastTime = 0;
		let frameCount = 0;
		let fpsTimer = 0;
		let destroyed = false;

		const DT_YEAR = 1 / 365.25; // 1 day in years (base timestep)

		async function start() {
			const result = await initWebGPU();
			if (!isWebGPUAvailable(result)) {
				gpuAvailable = false;
				statusMessage = result.reason;
				onError?.(result.reason);
				return;
			}

			engine = new NBodyEngine(result.device);

			// Configure canvas context
			const context = canvas!.getContext('webgpu') as GPUCanvasContext | null;
			if (!context) {
				statusMessage = 'Could not get WebGPU canvas context.';
				onError?.('Could not get WebGPU canvas context.');
				return;
			}

			await engine.initRender(context);

			// Size canvas to display dimensions
			const { width, height } = canvas!.getBoundingClientRect();
			canvas!.width = width * devicePixelRatio;
			canvas!.height = height * devicePixelRatio;
			camera.setViewport(canvas!.width, canvas!.height);
			engine.resize(canvas!.width, canvas!.height);

			// Load default solar-system-like preset
			engine.loadBodies(defaultBodies());
			onBodyCountChange?.(engine.bodyCount);

			statusMessage = '';

			// Resize observer
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

			// rAF loop
			function loop(time: number) {
				if (destroyed) return;
				rafId = requestAnimationFrame(loop);

				const dt = Math.min((time - lastTime) / 1000, 0.05); // cap at 50ms
				lastTime = time;

				// FPS tracking (1-second window)
				frameCount++;
				fpsTimer += dt;
				if (fpsTimer >= 1) {
					onFpsChange?.(Math.round(frameCount / fpsTimer));
					frameCount = 0;
					fpsTimer = 0;
				}

				if (!paused && engine) {
					const simDt = DT_YEAR * timeScale;
					engine.step(simDt);
					onSimTimeChange?.(engine.simulationTime);
				}

				if (engine && context) {
					engine.render(context, camera);
				}
			}

			lastTime = performance.now();
			rafId = requestAnimationFrame(loop);

			// Cleanup
			return () => {
				destroyed = true;
				cancelAnimationFrame(rafId);
				ro.disconnect();
				engine?.destroy();
				engine = null;
			};
		}

		const cleanup = start();
		return () => {
			destroyed = true;
			cancelAnimationFrame(rafId);
			cleanup.then((fn) => fn?.());
		};
	});

	// ---------------------------------------------------------------------------
	// Pointer interaction — pan & zoom
	// ---------------------------------------------------------------------------
	let dragging = false;
	let lastPointer = { x: 0, y: 0 };

	function onpointerdown(e: PointerEvent) {
		dragging = true;
		lastPointer = { x: e.clientX, y: e.clientY };
		(e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
	}

	function onpointermove(e: PointerEvent) {
		if (!dragging) return;
		camera.pan(e.clientX - lastPointer.x, e.clientY - lastPointer.y);
		lastPointer = { x: e.clientX, y: e.clientY };
	}

	function onpointerup(e: PointerEvent) {
		dragging = false;
		(e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId);
	}

	function onwheel(e: WheelEvent) {
		e.preventDefault();
		const factor = e.deltaY < 0 ? 1.1 : 0.9;
		camera.zoom(factor, e.offsetX, e.offsetY);
	}

	// Keyboard: arrow keys = pan, +/- = zoom
	function onkeydown(e: KeyboardEvent) {
		const PAN_PX = 40;
		switch (e.key) {
			case 'ArrowLeft':  camera.pan(-PAN_PX, 0); e.preventDefault(); break;
			case 'ArrowRight': camera.pan( PAN_PX, 0); e.preventDefault(); break;
			case 'ArrowUp':    camera.pan(0, -PAN_PX); e.preventDefault(); break;
			case 'ArrowDown':  camera.pan(0,  PAN_PX); e.preventDefault(); break;
			case '+':
			case '=':          camera.zoom(1.2); break;
			case '-':
			case '_':          camera.zoom(0.8); break;
		}
	}

	// ---------------------------------------------------------------------------
	// Default scene: Sun + 4 planets
	// ---------------------------------------------------------------------------
	function defaultBodies(): BodyData[] {
		return [
			{ name: 'Sun',     x: 0,    y: 0,    vx: 0,       vy: 0,       mass: 1.0,    radius: 0.005, type: BodyType.STAR,    active: 1 },
			{ name: 'Mercury', x: 0.39, y: 0,    vx: 0,       vy: 10.07,   mass: 1.65e-7, radius: 0.0002, type: BodyType.PLANET,  active: 1 },
			{ name: 'Venus',   x: 0.72, y: 0,    vx: 0,       vy: 7.39,    mass: 2.44e-6, radius: 0.0005, type: BodyType.PLANET,  active: 1 },
			{ name: 'Earth',   x: 1.0,  y: 0,    vx: 0,       vy: 6.2832,  mass: 3.0e-6,  radius: 0.0005, type: BodyType.PLANET,  active: 1 },
			{ name: 'Mars',    x: 1.52, y: 0,    vx: 0,       vy: 5.09,    mass: 3.2e-7,  radius: 0.0003, type: BodyType.PLANET,  active: 1 },
		];
	}
</script>

<!-- Status overlay when GPU is unavailable or still loading -->
{#if statusMessage}
	<div
		class="absolute inset-0 flex items-center justify-center bg-black/90 text-white text-sm px-4 text-center"
		role="status"
		aria-live="polite"
	>
		{#if !gpuAvailable}
			<p>
				<strong>WebGPU not available</strong><br />
				{statusMessage}
			</p>
		{:else}
			<p aria-label="Loading simulation">{statusMessage}</p>
		{/if}
	</div>
{/if}

<canvas
	bind:this={canvas}
	class="w-full h-full block"
	aria-label="2D gravity simulation — drag to pan, scroll to zoom, arrow keys to navigate"
	tabindex="0"
	{onpointerdown}
	{onpointermove}
	{onpointerup}
	{onwheel}
	{onkeydown}
></canvas>

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
