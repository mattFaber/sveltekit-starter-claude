<script lang="ts">
	import Button from '$lib/components/atoms/Button.svelte';
	import { PRESETS, type Preset } from '$lib/simulation/presets/index.js';

	let { onSelect }: { onSelect: (preset: Preset) => void } = $props();
</script>

<section aria-labelledby="preset-heading" class="p-3 space-y-2">
	<h2 id="preset-heading" class="text-sm font-mono text-white/80 font-semibold">Presets</h2>

	<ul role="list" class="space-y-1">
		{#each PRESETS as preset (preset.id)}
			<li>
				<button
					class="w-full text-left px-3 py-2 rounded border border-white/10 bg-white/5 hover:bg-white/10 focus:outline-none focus:border-yellow-400 transition-colors"
					onclick={() => onSelect(preset)}
					aria-label="Load preset: {preset.label}"
				>
					<p class="text-sm font-mono text-white">{preset.label}</p>
					<p class="text-xs text-white/40 mt-0.5">{preset.description}</p>
				</button>
			</li>
		{/each}
	</ul>
</section>
