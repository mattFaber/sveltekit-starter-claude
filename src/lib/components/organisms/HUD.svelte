<script lang="ts">
	import Badge from '$lib/components/atoms/Badge.svelte';
	import { simulation } from '$lib/stores/simulation.svelte.js';
</script>

<!--
  HUD — heads-up display overlay.
  aria-live="polite" announces body count and pause state to screen readers.
-->
<div
	class="flex items-center gap-4 px-4 py-2 font-mono text-xs bg-black/50 backdrop-blur-sm"
	aria-label="Simulation metrics"
>
	<Badge label="FPS " value={simulation.fps} color={simulation.fps < 30 ? 'red' : 'green'} />
	<Badge label="Bodies " value={simulation.bodyCount} color="yellow" />
	<Badge label="Time " value="{simulation.simYears.toFixed(2)} yr" />

	{#if simulation.paused}
		<span class="text-yellow-400 animate-pulse" aria-hidden="true">⏸ PAUSED</span>
	{/if}
</div>

<!-- Screen-reader live region (outside the visual HUD so it's always announced) -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
	{#if simulation.paused}
		Simulation paused. {simulation.bodyCount} bodies.
	{:else}
		{simulation.bodyCount} bodies simulating.
	{/if}
</div>
