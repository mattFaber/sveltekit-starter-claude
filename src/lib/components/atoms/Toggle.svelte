<script lang="ts">
	let {
		checked = $bindable(false),
		label,
		id,
	}: {
		checked?: boolean;
		label: string;
		id: string;
	} = $props();
</script>

<label for={id} class="inline-flex items-center gap-2 cursor-pointer select-none text-sm text-white">
	<span class="relative">
		<input
			{id}
			type="checkbox"
			class="sr-only peer"
			bind:checked
		/>
		<!-- Track -->
		<span
			class="block w-8 h-4 rounded-full border border-white/30 bg-white/10 peer-checked:bg-yellow-400/30 peer-checked:border-yellow-400 transition-colors"
		></span>
		<!-- Thumb -->
		<span
			class="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white/60 peer-checked:translate-x-4 peer-checked:bg-yellow-400 transition-all"
		></span>
	</span>
	{label}
</label>
