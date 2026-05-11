<script lang="ts">
	let {
		value = $bindable(1),
		min = 0,
		max = 10,
		step = 0.1,
		label,
		id,
		formatValue,
	}: {
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		label: string;
		id: string;
		formatValue?: (v: number) => string;
	} = $props();

	const display = $derived(formatValue ? formatValue(value) : value.toFixed(1));
</script>

<div class="flex items-center gap-2 text-xs font-mono text-white">
	<label for={id} class="shrink-0 text-white/60">{label}</label>
	<input
		{id}
		type="range"
		{min}
		{max}
		{step}
		bind:value
		class="w-full accent-yellow-400"
		aria-valuemin={min}
		aria-valuemax={max}
		aria-valuenow={value}
		aria-valuetext={display}
	/>
	<span class="shrink-0 w-8 text-right text-yellow-400">{display}</span>
</div>
