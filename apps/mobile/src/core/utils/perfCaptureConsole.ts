type PerfCaptureConsoleGlobal = typeof globalThis & {
  __RABBY_STARTUP_PROFILER_ACTIVE_UNTIL__?: number;
  __RABBY_PERF_CAPTURE_CONSOLE_NOISE_SUPPRESSED_UNTIL__?: number;
};

export function shouldSuppressPerfCaptureConsoleNoise() {
  const global = globalThis as PerfCaptureConsoleGlobal;
  const activeUntil = Number(
    global.__RABBY_PERF_CAPTURE_CONSOLE_NOISE_SUPPRESSED_UNTIL__ ||
      global.__RABBY_STARTUP_PROFILER_ACTIVE_UNTIL__ ||
      0,
  );

  return Number.isFinite(activeUntil) && activeUntil > Date.now();
}
