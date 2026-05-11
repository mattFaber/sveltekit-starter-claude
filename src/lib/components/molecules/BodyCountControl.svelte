<script lang="ts">
	/**
	 * BodyCountControl — molecule combining a Slider + NumberInput
	 * for setting the maximum body count, with an aria-live announcement.
	 */
	import Slider from '$lib/components/atoms/Slider.svelte';
	import NumberInput from '$lib/components/atoms/NumberInput.svelte';

	const MIN = 1;
	const MAX = 16384;

	let {
		value = $bindable(5),
	}: {
		value?: number;
	} = $props();

	// Keep slider and number input in sync
	let sliderValue  = $state(value);
	let numberValue  = $state(value);

	$effect(() => { sliderValue = value; numberValue = value; });
	$effect(() => { value = sliderValue; });
	$effect(() => { value = numberValue; });

	const announced = $derived(`${value} bodies`);
</script>

<div class="space-y-1">
	<Slider
		id="body-count-slider"
		label="Max bodies"
		min={MIN}
		max={MAX}
		step={1}
		bind:value={sliderValue}
		formatValue={(v) => String(Math.round(v))}
	/>
	<NumberInput
		id="body-count-input"
		label=""
		min={MIN}
		max={MAX}
		step={1}
		bind:value={numberValue}
		unit="bodies"
	/>
	<div aria-live="polite" aria-atomic="true" class="sr-only">{announced}</div>
</div>
