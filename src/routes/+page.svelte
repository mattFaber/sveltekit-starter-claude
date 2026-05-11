<script lang="ts">
	import SimulationCanvas from '$lib/components/SimulationCanvas.svelte';

	let paused = $state(false);
	let timeScale = $state(1);
	let fps = $state(0);
	let bodyCount = $state(0);
	let simYears = $state(0);
	let gpuError = $state('');
</script>

<main class="relative w-screen h-screen bg-black overflow-hidden flex flex-col">
	<!-- HUD overlay -->
	<header
		class="absolute top-0 left-0 right-0 z-10 flex items-center gap-4 px-4 py-2 bg-black/40 text-white text-xs font-mono"
		aria-label="Simulation status"
	>
		<span aria-label="Frames per second">{fps} FPS</span>
		<span aria-label="Body count">{bodyCount} bodies</span>
		<span aria-label="Simulation time">{simYears.toFixed(2)} yr</span>

		<div class="ml-auto flex items-center gap-3">
			<!-- Time scale control -->
			<label class="flex items-center gap-1">
				<span>Speed</span>
				<input
					type="range"
					min="0.1"
					max="10"
					step="0.1"
					bind:value={timeScale}
					class="w-24 accent-yellow-400"
					aria-label="Simulation time scale"
				/>
				<span>{timeScale.toFixed(1)}×</span>
			</label>

			<!-- Pause/resume -->
			<button
				onclick={() => (paused = !paused)}
				class="px-3 py-1 rounded border border-white/30 hover:bg-white/10 active:bg-white/20 transition-colors"
				aria-pressed={paused}
				aria-label={paused ? 'Resume simulation' : 'Pause simulation'}
			>
				{paused ? '▶ Resume' : '⏸ Pause'}
			</button>
		</div>
	</header>

	{#if gpuError}
		<div role="alert" class="absolute inset-0 flex items-center justify-center bg-black text-white p-8 text-center">
			<p><strong>WebGPU unavailable:</strong> {gpuError}</p>
		</div>
	{:else}
		<!-- Simulation canvas fills remaining space -->
		<div class="flex-1 relative">
			<SimulationCanvas
				{paused}
				{timeScale}
				onBodyCountChange={(n) => (bodyCount = n)}
				onSimTimeChange={(y) => (simYears = y)}
				onFpsChange={(f) => (fps = f)}
				onError={(msg) => (gpuError = msg)}
			/>
		</div>
	{/if}

	<!-- Screen-reader live region -->
	<div aria-live="polite" class="sr-only">
		{#if paused}Simulation paused.{:else}Simulation running, {bodyCount} bodies.{/if}
	</div>
</main>

