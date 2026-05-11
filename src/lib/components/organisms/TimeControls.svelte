<script lang="ts">
	import Button from '$lib/components/atoms/Button.svelte';
	import Slider from '$lib/components/atoms/Slider.svelte';
	import { simulation } from '$lib/stores/simulation.svelte.js';
</script>

<section
	aria-labelledby="time-controls-heading"
	class="flex items-center gap-3 px-4 py-2 bg-black/50 backdrop-blur-sm"
>
	<h2 id="time-controls-heading" class="sr-only">Time controls</h2>

	<!-- Play / Pause -->
	<Button
		pressed={simulation.paused}
		onclick={() => (simulation.paused = !simulation.paused)}
		aria-label={simulation.paused ? 'Resume simulation' : 'Pause simulation'}
	>
		{simulation.paused ? '▶' : '⏸'}
	</Button>

	<!-- Step forward one day (only active when paused) -->
	<Button
		variant="ghost"
		disabled={!simulation.paused}
		aria-label="Step forward one simulation day"
	>
		⏭
	</Button>

	<!-- Time scale -->
	<div class="w-48">
		<Slider
			id="time-scale"
			label="Speed"
			min={0.1}
			max={20}
			step={0.1}
			bind:value={simulation.timeScale}
			formatValue={(v) => `${v.toFixed(1)}×`}
		/>
	</div>

	<!-- Elapsed simulation time -->
	<time
		class="font-mono text-xs text-white/60 ml-auto"
		title="Elapsed simulation time"
		datetime={`P${simulation.simYears.toFixed(4)}Y`}
	>
		{simulation.simYears.toFixed(2)} yr
	</time>
</section>
