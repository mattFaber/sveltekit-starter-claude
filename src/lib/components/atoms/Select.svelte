<script lang="ts">
	let {
		value = $bindable(''),
		options,
		label,
		id,
	}: {
		value?: string;
		options: { value: string; label: string }[];
		label: string;
		id: string;
	} = $props();
</script>

<div class="flex flex-col gap-1">
	<label for={id} class="text-xs text-white/60 font-mono">{label}</label>
	<select
		{id}
		bind:value
		class="bg-black/60 border border-white/20 rounded px-2 py-1 text-sm text-white font-mono focus:outline-none focus:border-yellow-400"
	>
		{#each options as opt (opt.value)}
			<option value={opt.value}>{opt.label}</option>
		{/each}
	</select>
</div>
