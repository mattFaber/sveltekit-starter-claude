<script lang="ts">
	import Button from './Button.svelte';
	let { disabled = false, pressed }: { disabled?: boolean; pressed?: boolean } = $props();
</script>

<Button {disabled} {pressed}>Click me</Button>
