<script lang="ts">
	import Button from '$lib/components/atoms/Button.svelte';
	import NumberInput from '$lib/components/atoms/NumberInput.svelte';
	import BodyTypeSelector from '$lib/components/molecules/BodyTypeSelector.svelte';
	import VelocityControl from '$lib/components/molecules/VelocityControl.svelte';
	import { BodyType, type BodyData } from '$lib/simulation/physics/bodies.js';
	import { units } from '$lib/simulation/physics/units.js';

	let { onSpawn }: { onSpawn: (body: BodyData) => void } = $props();

	// Form state
	let bodyType = $state<BodyType>(BodyType.PLANET);
	let mass     = $state(3e-6);   // M☉ (Earth-like default)
	let radius   = $state(0.0005); // AU
	let x        = $state(1.0);    // AU
	let y        = $state(0.0);
	let vx       = $state(0.0);
	let vy       = $state(6.28);   // ~Earth circular speed AU/yr

	// Helpers
	const circularSpeed = $derived(
		x !== 0 ? units.circularOrbitSpeed(1.0, Math.abs(x)).toFixed(2) : '—'
	);

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		onSpawn({ x, y, vx, vy, mass, radius, type: bodyType, active: 1 });
	}

	function applyCircularVelocity() {
		vy = units.circularOrbitSpeed(1.0, Math.abs(x));
		vx = 0;
	}
</script>

<section aria-labelledby="spawn-heading" class="p-3 space-y-3 text-white">
	<h2 id="spawn-heading" class="text-sm font-mono text-white/80 font-semibold">Spawn Body</h2>

	<form onsubmit={handleSubmit} class="space-y-3" novalidate>
		<BodyTypeSelector bind:value={bodyType} />

		<!-- Position -->
		<fieldset class="border border-white/10 rounded p-3 space-y-2">
			<legend class="text-xs text-white/50 font-mono px-1">Position (AU)</legend>
			<NumberInput id="spawn-x" label="X" bind:value={x} step={0.1} unit="AU" />
			<NumberInput id="spawn-y" label="Y" bind:value={y} step={0.1} unit="AU" />
		</fieldset>

		<VelocityControl bind:vx bind:vy />

		<!-- Quick-fill circular orbit velocity -->
		<Button variant="ghost" size="sm" type="button" onclick={applyCircularVelocity}>
			↺ Circular orbit speed ({circularSpeed} AU/yr)
		</Button>

		<!-- Mass + radius -->
		<fieldset class="border border-white/10 rounded p-3 space-y-2">
			<legend class="text-xs text-white/50 font-mono px-1">Properties</legend>
			<NumberInput id="spawn-mass"   label="Mass"   bind:value={mass}   step={1e-7} unit="M☉" />
			<NumberInput id="spawn-radius" label="Radius" bind:value={radius} step={1e-4} unit="AU" />
		</fieldset>

		<Button type="submit" variant="primary">
			+ Spawn
		</Button>
	</form>
</section>
