function loadRecorder(enabled = true) {
  jest.doMock('@/core/utils/diagnosticEnv', () => ({
    isNonProductionDiagnosticsEnabled: enabled,
  }));

  return require('./recorder') as typeof import('./recorder');
}

describe('startup performance recorder', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('keeps startup events in memory until a batch is requested', () => {
    const recorder = loadRecorder();

    recorder.startStartupPerformanceRecording('test');
    recorder.recordStartupPerformanceEvent('startup-task', 'task_fire', {
      id: 7,
      label: 'load remote config',
    });

    expect(recorder.getStartupPerformanceRecorderSnapshot()).toMatchObject({
      enabled: true,
      started: true,
      stopped: false,
      activeTaskLabels: ['load remote config'],
    });

    recorder.recordStartupPerformanceEvent(
      'startup-task',
      'task_invoke_return',
      {
        id: 7,
        invokeSyncMs: 4,
        isAsync: true,
      },
    );
    recorder.recordStartupPerformanceEvent('startup-task', 'task_done', {
      id: 7,
      durationMs: 1200,
      invokeSyncMs: 4,
      awaitWallMs: 1196,
      isAsync: true,
    });
    recorder.stopStartupPerformanceRecording('test_done');

    expect(
      recorder.getStartupPerformanceRecorderSnapshot().activeTaskLabels,
    ).toEqual([]);

    const batch = recorder.takeStartupPerformanceEventBatch();
    expect(batch).not.toBeNull();
    expect(batch?.chunkSequence).toBe(0);
    expect(batch?.events.map(event => `${event.scope}:${event.event}`)).toEqual(
      [
        'session:start',
        'startup-task:task_fire',
        'startup-task:task_invoke_return',
        'startup-task:task_done',
        'session:stop',
      ],
    );
    expect(recorder.takeStartupPerformanceEventBatch()).toBeNull();
  });

  it('restores a drained batch when persistence fails', () => {
    const recorder = loadRecorder();

    recorder.recordStartupPerformanceEvent('runtime', 'phase', {
      phase: 'launch',
    });
    const batch = recorder.takeStartupPerformanceEventBatch();
    expect(batch?.events).toHaveLength(1);

    recorder.restoreStartupPerformanceEventBatch(batch!);

    const restoredBatch = recorder.takeStartupPerformanceEventBatch();
    expect(restoredBatch?.events).toEqual(batch?.events);
  });

  it('is inert in production builds', () => {
    const recorder = loadRecorder(false);

    recorder.startStartupPerformanceRecording('production');
    recorder.recordStartupPerformanceEvent('runtime', 'phase');

    expect(recorder.getStartupPerformanceRecorderSnapshot()).toMatchObject({
      enabled: false,
      started: false,
      pendingEventCount: 0,
    });
    expect(recorder.takeStartupPerformanceEventBatch()).toBeNull();
  });
});
