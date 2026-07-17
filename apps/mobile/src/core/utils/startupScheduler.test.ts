function loadStartupScheduler() {
  const markStartupTaskDiagnostic = jest.fn();

  jest.doMock('./diagnosticEnv', () => ({
    isNonProductionDiagnosticsEnabled: true,
  }));
  jest.doMock('./androidTrace', () => ({
    traceAndroidInstant: jest.fn(),
  }));
  jest.doMock('./homeStartupReady', () => ({
    runAfterHomePostStartupReady: jest.fn(),
    traceHomeStartupReady: jest.fn(),
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
  };
}

describe('startup scheduler timing diagnostics', () => {
  afterEach(() => {
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
});
