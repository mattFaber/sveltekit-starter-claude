import { describe, it, expect } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import Badge from './Badge.svelte';

describe('Badge', () => {
	it('renders label and value', async () => {
		render(Badge, { label: 'FPS', value: 60 });
		await expect.element(page.getByText('FPS')).toBeInTheDocument();
		await expect.element(page.getByText('60')).toBeInTheDocument();
	});

	it('sets aria-label combining label and value', async () => {
		const { container } = render(Badge, { label: 'Bodies', value: 5 });
		const span = container.querySelector('[aria-label="Bodies: 5"]');
		expect(span).not.toBeNull();
	});
});
