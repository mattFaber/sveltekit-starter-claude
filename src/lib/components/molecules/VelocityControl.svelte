<script lang="ts">
	import NumberInput from '$lib/components/atoms/NumberInput.svelte';

	/**
	 * VelocityControl — two NumberInputs for vx/vy in AU/yr.
	 * Used in SpawnPanel (accessible alternative to canvas drag).
	 */
	let {
		vx = $bindable(0),
		vy = $bindable(0),
	}: {
		vx?: number;
		vy?: number;
	} = $props();

	const speed = $derived(Math.sqrt(vx * vx + vy * vy).toFixed(2));
</script>

<fieldset class="border border-white/10 rounded p-3 space-y-2">
	<legend class="text-xs text-white/50 font-mono px-1">Velocity (AU/yr)</legend>

	<NumberInput id="spawn-vx" label="Vx" bind:value={vx} step={0.1} unit="AU/yr" />
	<NumberInput id="spawn-vy" label="Vy" bind:value={vy} step={0.1} unit="AU/yr" />

	<p class="text-xs text-white/40 font-mono" aria-live="polite">
		Speed: <span class="text-yellow-400">{speed}</span> AU/yr
	</p>
</fieldset>
