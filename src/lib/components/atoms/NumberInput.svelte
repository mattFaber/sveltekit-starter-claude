<script lang="ts">
	let {
		value = $bindable(0),
		min,
		max,
		step = 1,
		label,
		id,
		unit = '',
	}: {
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		label: string;
		id: string;
		unit?: string;
	} = $props();
</script>

<div class="flex flex-col gap-1">
	<label for={id} class="text-xs text-white/60 font-mono">{label}</label>
	<div class="flex items-center gap-1">
		<input
			{id}
			type="number"
			{min}
			{max}
			{step}
			bind:value
			class="w-full bg-black/60 border border-white/20 rounded px-2 py-1 text-sm text-white font-mono focus:outline-none focus:border-yellow-400"
		/>
		{#if unit}
			<span class="text-xs text-white/40 font-mono shrink-0">{unit}</span>
		{/if}
	</div>
</div>
