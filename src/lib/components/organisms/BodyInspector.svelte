<script lang="ts">
	import { simulation } from '$lib/stores/simulation.svelte.js';
	import { BodyType } from '$lib/simulation/physics/bodies.js';

	const TYPE_LABEL: Record<number, string> = {
		[BodyType.STAR]:       '★ Star',
		[BodyType.PLANET]:     '◉ Planet',
		[BodyType.ASTEROID]:   '· Asteroid',
		[BodyType.BLACK_HOLE]: '◈ Black Hole',
	};
</script>

<section
	aria-labelledby="inspector-heading"
	class="p-3 space-y-2 text-white overflow-y-auto"
>
	<h2 id="inspector-heading" class="text-sm font-mono text-white/80 font-semibold">
		Bodies ({simulation.bodyCount})
	</h2>

	{#if simulation.bodies.length === 0}
		<p class="text-xs text-white/30 font-mono">No bodies loaded.</p>
	{:else}
		<ul role="listbox" aria-label="Body list" class="space-y-1">
			{#each simulation.bodies as body, i (i)}
				<li
					role="option"
					aria-selected={simulation.selectedBodyIndex === i}
					tabindex="0"
					class="flex items-center gap-2 px-2 py-1 rounded cursor-pointer text-xs font-mono
					       hover:bg-white/10 focus:outline-none focus:bg-white/10
					       {simulation.selectedBodyIndex === i ? 'bg-yellow-400/15 text-yellow-300' : 'text-white/70'}"
					onclick={() => (simulation.selectedBodyIndex = i)}
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') simulation.selectedBodyIndex = i; }}
				>
					<span class="w-24 truncate">{body.name ?? `Body ${i}`}</span>
					<span class="text-white/40">{TYPE_LABEL[body.type] ?? '?'}</span>
					<span class="ml-auto text-white/30">{body.mass.toExponential(1)} M☉</span>
				</li>
			{/each}
		</ul>
	{/if}

	<!-- Selected body details -->
	{#if simulation.selectedBodyIndex !== null}
		{@const body = simulation.bodies[simulation.selectedBodyIndex]}
		{#if body}
			<dl class="mt-2 border-t border-white/10 pt-2 text-xs font-mono space-y-1">
				<div class="flex justify-between">
					<dt class="text-white/40">Position</dt>
					<dd>{body.x.toFixed(3)}, {body.y.toFixed(3)} AU</dd>
				</div>
				<div class="flex justify-between">
					<dt class="text-white/40">Velocity</dt>
					<dd>{body.vx.toFixed(3)}, {body.vy.toFixed(3)} AU/yr</dd>
				</div>
				<div class="flex justify-between">
					<dt class="text-white/40">Mass</dt>
					<dd>{body.mass.toExponential(2)} M☉</dd>
				</div>
			</dl>
		{/if}
	{/if}
</section>
