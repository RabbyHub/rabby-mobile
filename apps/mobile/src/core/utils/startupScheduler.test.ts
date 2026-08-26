function loadStartupScheduler() {
  const markStartupTaskDiagnostic = jest.fn();
  const runAfterHomePostStartupReady = jest.fn(
    (
      _callback: () => void,
      _options?: { label?: string; fallbackMs?: number },
    ) => jest.fn(),
  );
  const runAfterHomeEntryReady = jest.fn();
  const runAfterHomeContentReady = jest.fn();
  const runAfterInteractions = jest.fn((_callback: () => void) => ({
    cancel: jest.fn(),
  }));

  jest.doMock('react-native', () => ({
    InteractionManager: { runAfterInteractions },
  }));
  jest.doMock('./diagnosticEnv', () => ({
    isNonProductionDiagnosticsEnabled: true,
  }));
  jest.doMock('./androidTrace', () => ({
    traceAndroidInstant: jest.fn(),
  }));
  jest.doMock('./homeStartupReady', () => ({
    runAfterHomePostStartupReady,
    traceHomeStartupReady: jest.fn(),
  }));
  jest.doMock('./homeStartupMilestones', () => ({
    runAfterHomeEntryReady,
    runAfterHomeContentReady,
  }));
  jest.doMock('@/startup/runtimeDiagnostics', () => ({
    markStartupRuntimePhase: jest.fn(),
  }));
  jest.doMock('./startupDiagnostics', () => ({
    beginStartupTaskDiagnostic: jest.fn(() => 1),
    markStartupTaskDiagnostic,
  }));

  return {
    scheduler:
      require('./startupScheduler') as typeof import('./startupScheduler'),
    markStartupTaskDiagnostic,
    runAfterHomePostStartupReady,
    runAfterHomeEntryReady,
    runAfterHomeContentReady,
    runAfterInteractions,
    userVisibleJsWork:
      require('./userVisibleJsWork') as typeof import('./userVisibleJsWork'),
  };
}

describe('startup scheduler timing diagnostics', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('does not treat Promise waiting time as JS-thread budget usage', async () => {
    const { scheduler, markStartupTaskDiagnostic } = loadStartupScheduler();
    const now = jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1004)
      .mockReturnValueOnce(2200);
    let resolveTask!: () => void;
    const taskResult = new Promise<void>(resolve => {
      resolveTask = resolve;
    });

    scheduler.scheduleStartupTask(() => taskResult, {
      label: 'fetch remote config',
      budgetMs: 20,
    });
    resolveTask();
    await taskResult;
    await Promise.resolve();

    expect(now).toHaveBeenCalledTimes(3);
    expect(markStartupTaskDiagnostic).toHaveBeenCalledWith(1, 'invoke_return', {
      invokeSyncMs: 4,
      isAsync: true,
    });
    expect(markStartupTaskDiagnostic).toHaveBeenCalledWith(1, 'done', {
      durationMs: 1200,
      invokeSyncMs: 4,
      awaitWallMs: 1196,
      isAsync: true,
    });
    expect(markStartupTaskDiagnostic).not.toHaveBeenCalledWith(
      1,
      'budget_exceeded',
      expect.anything(),
    );
  });

  it('reports a synchronous task that exceeds its JS-thread budget', () => {
    const { scheduler, markStartupTaskDiagnostic } = loadStartupScheduler();
    jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(1000)
      .mockReturnValueOnce(1030)
      .mockReturnValueOnce(1030);

    scheduler.scheduleStartupTask(() => undefined, {
      label: 'synchronous setup',
      budgetMs: 20,
    });

    expect(markStartupTaskDiagnostic).toHaveBeenCalledWith(
      1,
      'budget_exceeded',
      {
        durationMs: 30,
        invokeSyncMs: 30,
        awaitWallMs: 0,
        isAsync: false,
      },
    );
  });

  it.each([
    ['homeEntryReady', 'runAfterHomeEntryReady', { label: 'homeEntryReady' }],
    [
      'homeContentReady',
      'runAfterHomeContentReady',
      { label: 'homeContentReady', fallbackMs: 5000 },
    ],
  ] as const)(
    'waits for the %s milestone',
    (stage, waiterName, expectedOptions) => {
      const loaded = loadStartupScheduler();
      const task = jest.fn();

      loaded.scheduler.scheduleStartupTask(task, {
        stage,
        label: stage,
        fallbackMs: 5000,
      });

      expect(task).not.toHaveBeenCalled();
      const waiter = loaded[waiterName];
      expect(waiter).toHaveBeenCalledWith(
        expect.any(Function),
        expectedOptions,
      );

      waiter.mock.calls[0]?.[0]();
      expect(task).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps idle startup work behind active visible JS work', () => {
    jest.useFakeTimers();
    const loaded = loadStartupScheduler();
    const task = jest.fn();
    const releaseVisibleWork =
      loaded.userVisibleJsWork.beginUserVisibleJsWork('token-load');

    loaded.scheduler.scheduleStartupTask(task, {
      stage: 'homePostStartupIdle',
      label: 'idle-warmup',
    });
    loaded.runAfterHomePostStartupReady.mock.calls[0]?.[0]();

    expect(loaded.runAfterInteractions).not.toHaveBeenCalled();
    releaseVisibleWork();
    jest.advanceTimersByTime(249);
    expect(loaded.runAfterInteractions).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(loaded.runAfterInteractions).toHaveBeenCalledTimes(1);

    const releaseSecondVisibleWork =
      loaded.userVisibleJsWork.beginUserVisibleJsWork('projection-hydration');
    loaded.runAfterInteractions.mock.calls[0]?.[0]();
    expect(task).not.toHaveBeenCalled();

    releaseSecondVisibleWork();
    jest.advanceTimersByTime(250);
    expect(loaded.runAfterInteractions).toHaveBeenCalledTimes(2);
    loaded.runAfterInteractions.mock.calls[1]?.[0]();
    expect(task).toHaveBeenCalledTimes(1);
  });
});
