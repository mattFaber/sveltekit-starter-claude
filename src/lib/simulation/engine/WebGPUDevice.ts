/**
 * WebGPU device initialisation with capability detection.
 * Returns null (with an error message) instead of throwing, so callers
 * can gracefully degrade to the Canvas2D fallback.
 */

export interface WebGPUDeviceResult {
	device: GPUDevice;
	adapter: GPUAdapter;
}

export interface WebGPUUnavailableResult {
	device: null;
	adapter: null;
	reason: string;
}

export type WebGPUInitResult = WebGPUDeviceResult | WebGPUUnavailableResult;

/**
 * Request a WebGPU adapter + device.
 * Prefer a high-performance (discrete) GPU for the simulation workload.
 */
export async function initWebGPU(): Promise<WebGPUInitResult> {
	if (!navigator.gpu) {
		return { device: null, adapter: null, reason: 'WebGPU is not supported in this browser.' };
	}

	const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
	if (!adapter) {
		return {
			device: null,
			adapter: null,
			reason: 'No suitable GPU adapter found. Try updating your GPU drivers or browser.'
		};
	}

	// Request timestamp-query if available (used by HUD for GPU timing)
	const requiredFeatures: GPUFeatureName[] = [];
	if (adapter.features.has('timestamp-query')) {
		requiredFeatures.push('timestamp-query');
	}

	let device: GPUDevice;
	try {
		device = await adapter.requestDevice({ requiredFeatures });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : String(err);
		return { device: null, adapter: null, reason: `Failed to acquire GPU device: ${message}` };
	}

	device.lost.then((info) => {
		console.error(`WebGPU device lost: ${info.message} (reason: ${info.reason})`);
	});

	return { device, adapter };
}

export function isWebGPUAvailable(result: WebGPUInitResult): result is WebGPUDeviceResult {
	return result.device !== null;
}
