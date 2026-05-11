<script lang="ts">
	let {
		label,
		value,
		color = 'white',
	}: {
		label: string;
		value: string | number;
		color?: 'white' | 'yellow' | 'green' | 'red';
	} = $props();

	const colors = {
		white:  'text-white/80',
		yellow: 'text-yellow-400',
		green:  'text-green-400',
		red:    'text-red-400',
	};
</script>

<span class="font-mono text-xs" aria-label="{label}: {value}">
	<span class="text-white/40">{label}</span>
	<span class={colors[color]}>{value}</span>
</span>
