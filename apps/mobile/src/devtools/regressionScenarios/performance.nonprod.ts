import type { RegressionScenarioComponentActionTiming } from './componentActions.nonprod';

type DurationSummary = Readonly<{
  count: number;
  totalMs: number;
  averageMs: number;
  minMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
}>;

type ActionTimingSamples = {
  waitMs: number[];
  handlerMs: number[];
  totalMs: number[];
};

type PerformanceProbeOptions = Readonly<{
  heartbeatMs?: number;
  stallThresholdMs?: number;
  now?: () => number;
}>;

const DEFAULT_HEARTBEAT_MS = 50;
const DEFAULT_STALL_THRESHOLD_MS = 120;

function percentile(sorted: readonly number[], ratio: number) {
  const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index] ?? 0;
}

export function summarizeRegressionScenarioDurations(
  samples: readonly number[],
): DurationSummary {
  const sorted = [...samples].sort((left, right) => left - right);
  const totalMs = sorted.reduce((total, sample) => total + sample, 0);
  return {
    count: sorted.length,
    totalMs,
    averageMs: sorted.length ? Math.round(totalMs / sorted.length) : 0,
    minMs: sorted[0] ?? 0,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    maxMs: sorted.at(-1) ?? 0,
  };
}

export function createRegressionScenarioPerformanceProbe(
  options: PerformanceProbeOptions = {},
) {
  const heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
  const stallThresholdMs =
    options.stallThresholdMs ?? DEFAULT_STALL_THRESHOLD_MS;
  const now = options.now ?? Date.now;
  const startedAt = now();
  const actionSamples = new Map<string, ActionTimingSamples>();
  const durationSamples = new Map<string, number[]>();
  const jsGapSamples: number[] = [];
  let previousHeartbeatAt = startedAt;
  let stopped = false;

  const heartbeatTimer = setInterval(() => {
    const current = now();
    const gapMs = current - previousHeartbeatAt;
    previousHeartbeatAt = current;
    if (gapMs >= stallThresholdMs) {
      jsGapSamples.push(gapMs);
    }
  }, heartbeatMs);

  function recordAction(
    label: string,
    timing: RegressionScenarioComponentActionTiming,
  ) {
    const samples = actionSamples.get(label) || {
      waitMs: [],
      handlerMs: [],
      totalMs: [],
    };
    samples.waitMs.push(timing.waitMs);
    samples.handlerMs.push(timing.handlerMs);
    samples.totalMs.push(timing.totalMs);
    actionSamples.set(label, samples);
  }

  function recordDuration(label: string, durationMs: number) {
    const samples = durationSamples.get(label) || [];
    samples.push(durationMs);
    durationSamples.set(label, samples);
  }

  function stop() {
    if (!stopped) {
      stopped = true;
      clearInterval(heartbeatTimer);
    }

    return {
      elapsedMs: now() - startedAt,
      heartbeatMs,
      stallThresholdMs,
      jsGaps: summarizeRegressionScenarioDurations(jsGapSamples),
      estimatedJsStallMs: jsGapSamples.reduce(
        (total, gapMs) => total + Math.max(0, gapMs - heartbeatMs),
        0,
      ),
      actions: Object.fromEntries(
        [...actionSamples.entries()].map(([label, samples]) => [
          label,
          {
            wait: summarizeRegressionScenarioDurations(samples.waitMs),
            handler: summarizeRegressionScenarioDurations(samples.handlerMs),
            total: summarizeRegressionScenarioDurations(samples.totalMs),
          },
        ]),
      ),
      durations: Object.fromEntries(
        [...durationSamples.entries()].map(([label, samples]) => [
          label,
          summarizeRegressionScenarioDurations(samples),
        ]),
      ),
    };
  }

  return {
    recordAction,
    recordDuration,
    stop,
  };
}
