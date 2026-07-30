import {
  createRegressionScenarioPerformanceProbe,
  summarizeRegressionScenarioDurations,
} from './performance.nonprod';

describe('regression scenario performance probe', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('summarizes measured durations', () => {
    expect(summarizeRegressionScenarioDurations([40, 10, 30, 20])).toEqual({
      count: 4,
      totalMs: 100,
      averageMs: 25,
      minMs: 10,
      p50Ms: 20,
      p95Ms: 40,
      maxMs: 40,
    });
  });

  it('separates component action waiting from handler work', () => {
    const probe = createRegressionScenarioPerformanceProbe();
    probe.recordAction('selector.open', {
      waitMs: 30,
      handlerMs: 5,
      totalMs: 35,
    });
    probe.recordAction('selector.open', {
      waitMs: 10,
      handlerMs: 7,
      totalMs: 17,
    });
    const summary = probe.stop();

    expect(summary.actions['selector.open']).toMatchObject({
      wait: { count: 2, p50Ms: 10, maxMs: 30 },
      handler: { count: 2, p50Ms: 5, maxMs: 7 },
      total: { count: 2, p50Ms: 17, maxMs: 35 },
    });
  });

  it('records delayed event-loop heartbeats without emitting per-gap logs', () => {
    jest.useFakeTimers();
    let currentTime = 0;
    const probe = createRegressionScenarioPerformanceProbe({
      heartbeatMs: 50,
      stallThresholdMs: 120,
      now: () => currentTime,
    });

    currentTime = 180;
    jest.advanceTimersByTime(50);
    const summary = probe.stop();

    expect(summary.jsGaps).toMatchObject({
      count: 1,
      maxMs: 180,
    });
    expect(summary.estimatedJsStallMs).toBe(130);
  });
});
