<script lang="ts">
	import SimulationCanvas from '$lib/components/SimulationCanvas.svelte';
	import HUD from '$lib/components/organisms/HUD.svelte';
	import TimeControls from '$lib/components/organisms/TimeControls.svelte';
	import SpawnPanel from '$lib/components/organisms/SpawnPanel.svelte';
	import BodyInspector from '$lib/components/organisms/BodyInspector.svelte';
	import PresetMenu from '$lib/components/organisms/PresetMenu.svelte';
	import { simulation } from '$lib/stores/simulation.svelte.js';
	import type { BodyData } from '$lib/simulation/physics/bodies.js';
	import type { Preset } from '$lib/simulation/presets/index.js';

	let canvasRef = $state<ReturnType<typeof SimulationCanvas> | null>(null);
	let sidebarOpen = $state(true);

	function handleSpawn(body: BodyData) {
		canvasRef?.spawnBody(body);
	}

	function handlePreset(preset: Preset) {
		canvasRef?.loadPreset(preset.build());
	}
</script>

<main class="flex w-screen h-screen bg-black overflow-hidden">
	<!-- Simulation canvas — fills all remaining space -->
	<div class="relative flex-1 min-w-0">
		<SimulationCanvas bind:this={canvasRef} />

		<!-- Top HUD bar -->
		<header class="absolute top-0 left-0 right-0 z-10 flex items-center">
			<HUD />

			<div class="ml-auto pr-2">
				<button
					class="px-2 py-1 text-xs font-mono text-white/50 hover:text-white border border-white/20 rounded"
					onclick={() => (sidebarOpen = !sidebarOpen)}
					aria-expanded={sidebarOpen}
					aria-controls="sidebar"
					aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
				>
					{sidebarOpen ? '⊳ Hide' : '⊲ Show'}
				</button>
			</div>
		</header>

		<!-- Bottom time controls bar -->
		<footer class="absolute bottom-0 left-0 right-0 z-10">
			<TimeControls />
		</footer>
	</div>

	<!-- Right sidebar — spawn panel + body inspector -->
	{#if sidebarOpen}
		<aside
			id="sidebar"
			class="w-64 flex flex-col border-l border-white/10 bg-black/80 backdrop-blur-sm overflow-y-auto shrink-0"
			aria-label="Controls sidebar"
		>
			<PresetMenu onSelect={handlePreset} />
			<hr class="border-white/10" />
			<SpawnPanel onSpawn={handleSpawn} />
			<hr class="border-white/10" />
			<BodyInspector />
		</aside>
	{/if}

	{#if simulation.gpuError}
		<div role="alert" class="absolute inset-0 flex items-center justify-center bg-black text-white p-8 text-center z-50">
			<p><strong>WebGPU unavailable:</strong> {simulation.gpuError}</p>
		</div>
	{/if}
</main>

