<script lang="ts">
	let {
		variant = 'default',
		size = 'md',
		disabled = false,
		pressed,
		type = 'button',
		'aria-label': ariaLabel,
		children,
		onclick,
	}: {
		variant?: 'default' | 'primary' | 'ghost' | 'danger';
		size?: 'sm' | 'md';
		disabled?: boolean;
		/** When defined, renders as a toggle button with aria-pressed */
		pressed?: boolean;
		type?: 'button' | 'submit' | 'reset';
		'aria-label'?: string;
		children: import('svelte').Snippet;
		onclick?: (e: MouseEvent) => void;
	} = $props();

	const base = 'inline-flex items-center justify-center rounded border font-mono transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';
	const sizes = { sm: 'px-2 py-0.5 text-xs', md: 'px-3 py-1 text-sm' };
	const variants = {
		default:  'border-white/30 text-white hover:bg-white/10 active:bg-white/20',
		primary:  'border-yellow-400 text-yellow-400 hover:bg-yellow-400/10 active:bg-yellow-400/20',
		ghost:    'border-transparent text-white/60 hover:text-white hover:bg-white/5',
		danger:   'border-red-500 text-red-400 hover:bg-red-500/10',
	};
	const cls = $derived(`${base} ${sizes[size]} ${variants[variant]} ${disabled ? 'opacity-40 pointer-events-none' : ''}`);
</script>

<button
	{type}
	class={cls}
	{disabled}
	aria-pressed={pressed}
	aria-label={ariaLabel}
	{onclick}
>
	{@render children()}
</button>
