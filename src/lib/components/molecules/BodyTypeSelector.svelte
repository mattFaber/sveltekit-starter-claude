<script lang="ts">
	import Select from '$lib/components/atoms/Select.svelte';
	import { BodyType } from '$lib/simulation/physics/bodies.js';

	let {
		value = $bindable(BodyType.PLANET),
	}: {
		value?: BodyType;
	} = $props();

	// Convert BodyType enum to string for the Select atom, back on change
	let strValue = $state(String(value));
	$effect(() => { value = Number(strValue) as BodyType; });

	const options = [
		{ value: String(BodyType.STAR),       label: '★ Star' },
		{ value: String(BodyType.PLANET),     label: '◉ Planet' },
		{ value: String(BodyType.ASTEROID),   label: '· Asteroid' },
		{ value: String(BodyType.BLACK_HOLE), label: '◈ Black Hole' },
	];
</script>

<Select
	id="body-type"
	label="Body type"
	options={options}
	bind:value={strValue}
/>
