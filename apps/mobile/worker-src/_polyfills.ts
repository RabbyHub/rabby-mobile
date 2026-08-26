import 'fast-text-encoding';
import 'react-native/Libraries/Core/setUpTimers';
import 'react-native/Libraries/Core/setUpXHR';

export type WorkerRuntimeCapabilitySnapshot = {
  runtime: 'hermes' | 'unknown';
  capabilities: {
    fetch: boolean;
    headers: boolean;
    request: boolean;
    response: boolean;
    textDecoder: boolean;
    textEncoder: boolean;
    timers: boolean;
    xhr: boolean;
  };
  missing: string[];
};

export function getWorkerRuntimeCapabilitySnapshot(): WorkerRuntimeCapabilitySnapshot {
  const capabilities = {
    fetch: typeof globalThis.fetch === 'function',
    headers: typeof globalThis.Headers === 'function',
    request: typeof globalThis.Request === 'function',
    response: typeof globalThis.Response === 'function',
    textDecoder: typeof globalThis.TextDecoder === 'function',
    textEncoder: typeof globalThis.TextEncoder === 'function',
    timers:
      typeof globalThis.setTimeout === 'function' &&
      typeof globalThis.setInterval === 'function',
    xhr: typeof globalThis.XMLHttpRequest === 'function',
  };
  const missing = Object.entries(capabilities)
    .filter(([, available]) => !available)
    .map(([name]) => name);

  return {
    runtime: (globalThis as typeof globalThis & { HermesInternal?: unknown })
      .HermesInternal
      ? 'hermes'
      : 'unknown',
    capabilities,
    missing,
  };
}

export function assertWorkerRuntimeCapabilities() {
  const snapshot = getWorkerRuntimeCapabilitySnapshot();

  if (snapshot.missing.length) {
    throw new Error(
      `worker_runtime_missing_polyfills:${snapshot.missing.join(',')}`,
    );
  }

  return snapshot;
}
