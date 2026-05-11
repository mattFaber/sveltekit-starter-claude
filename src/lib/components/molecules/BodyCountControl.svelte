<script lang="ts">
	/**
	 * BodyCountControl — Slider + NumberInput for setting the maximum body count.
	 * Uses a single bindable prop; both inputs write directly to it.
	 */
	import Slider from '$lib/components/atoms/Slider.svelte';
	import NumberInput from '$lib/components/atoms/NumberInput.svelte';

	const MIN = 1;
	const MAX = 2048;  // practical interactive limit for the slider

	let {
		value = $bindable(512),
	}: {
		value?: number;
	} = $props();

	const announced = $derived(`Max bodies: ${value}`);
</script>

<div class="space-y-1">
	<Slider
		id="body-count-slider"
		label="Max bodies"
		min={MIN}
		max={MAX}
		step={1}
		bind:value
		formatValue={(v) => String(Math.round(v))}
	/>
	<NumberInput
		id="body-count-input"
		label="Exact limit"
		min={MIN}
		max={16384}
		step={1}
		bind:value
		unit="bodies"
	/>
	<div aria-live="polite" aria-atomic="true" class="sr-only">{announced}</div>
</div>
