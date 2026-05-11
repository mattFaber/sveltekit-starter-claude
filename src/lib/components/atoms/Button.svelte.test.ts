import { describe, it, expect } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import ButtonFixture from './Button.fixture.svelte';

describe('Button', () => {
	it('renders a button element with label text', async () => {
		render(ButtonFixture);
		await expect.element(page.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
	});

	it('is disabled when disabled prop is true', async () => {
		render(ButtonFixture, { disabled: true });
		const btn = page.getByRole('button', { name: 'Click me' });
		await expect.element(btn).toBeDisabled();
	});

	it('sets aria-pressed when pressed=true', async () => {
		render(ButtonFixture, { pressed: true });
		const btn = page.getByRole('button', { name: 'Click me' });
		await expect.element(btn).toHaveAttribute('aria-pressed', 'true');
	});
});
