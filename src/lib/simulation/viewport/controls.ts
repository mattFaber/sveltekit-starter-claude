import type { Camera } from './Camera.js';

export interface PointerControls {
	onpointerdown: (e: PointerEvent) => void;
	onpointermove: (e: PointerEvent) => void;
	onpointerup:   (e: PointerEvent) => void;
	onwheel:       (e: WheelEvent)   => void;
	onkeydown:     (e: KeyboardEvent) => void;
}

/**
 * Build canvas event handlers that drive a Camera.
 * Extracted from SimulationCanvas so they can be tested and reused.
 *
 * @param camera     The camera to mutate on pointer/keyboard events.
 * @param onSelect   Optional callback when the user clicks without dragging (body selection).
 */
export function buildControls(
	camera: Camera,
	onSelect?: (screenX: number, screenY: number) => void,
): PointerControls {
	let dragging = false;
	let dragMoved = false;
	let lastX = 0;
	let lastY = 0;

	const PAN_PX = 40;

	function onpointerdown(e: PointerEvent): void {
		dragging = true;
		dragMoved = false;
		lastX = e.clientX;
		lastY = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onpointermove(e: PointerEvent): void {
		if (!dragging) return;
		const dx = e.clientX - lastX;
		const dy = e.clientY - lastY;
		if (Math.abs(dx) > 2 || Math.abs(dy) > 2) dragMoved = true;
		camera.pan(dx, dy);
		lastX = e.clientX;
		lastY = e.clientY;
	}

	function onpointerup(e: PointerEvent): void {
		(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
		if (!dragMoved) {
			// Short tap without pan = selection click
			onSelect?.(e.offsetX, e.offsetY);
		}
		dragging = false;
		dragMoved = false;
	}

	function onwheel(e: WheelEvent): void {
		e.preventDefault();
		const factor = e.deltaY < 0 ? 1.1 : 0.9;
		camera.zoom(factor, e.offsetX, e.offsetY);
	}

	function onkeydown(e: KeyboardEvent): void {
		switch (e.key) {
			case 'ArrowLeft':  camera.pan(-PAN_PX, 0); e.preventDefault(); break;
			case 'ArrowRight': camera.pan( PAN_PX, 0); e.preventDefault(); break;
			case 'ArrowUp':    camera.pan(0, -PAN_PX); e.preventDefault(); break;
			case 'ArrowDown':  camera.pan(0,  PAN_PX); e.preventDefault(); break;
			case '+': case '=': camera.zoom(1.2); break;
			case '-': case '_': camera.zoom(0.8); break;
		}
	}

	return { onpointerdown, onpointermove, onpointerup, onwheel, onkeydown };
}
