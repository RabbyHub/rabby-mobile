import type {
  RegressionScenarioCommand,
  RegressionScenarioSession,
} from './contracts';
import {
  activateRegressionScenarioCommand,
  claimRegressionScenarioAction,
  clearRegressionScenarioRuntime,
  getRegressionScenarioRuntimeControlSnapshot,
  getRegressionScenarioRuntimeSnapshot,
  reportRegressionScenarioEvent,
  setRegressionScenarioRuntimeStatus,
  subscribeRegressionScenarioRuntimeControl,
} from './runtimeStore';

function makeCommand(runId: string): RegressionScenarioCommand {
  return {
    mode: 'lifecycle-e2e',
    action: 'start',
    commandId: `command-${runId}`,
    runId,
    scenario: 'lock-unlock',
    credentialProfile: 'regression-default',
    persistAcrossLaunches: false,
    expiresAt: Date.now() + 60_000,
    remainingLaunches: 0,
    params: {},
  };
}

function makeSession(
  command: RegressionScenarioCommand,
): RegressionScenarioSession {
  const now = Date.now();
  return {
    version: 1,
    command,
    status: 'armed',
    createdAt: now,
    updatedAt: now,
  };
}

describe('regression scenario one-shot actions', () => {
  afterEach(() => {
    clearRegressionScenarioRuntime();
  });

  it('allows an action once per run and resets for the next run', () => {
    const first = makeCommand('run-one');
    activateRegressionScenarioCommand(first, makeSession(first));

    expect(
      claimRegressionScenarioAction(first.runId, 'unlock-auto-submit'),
    ).toBe(true);
    expect(
      claimRegressionScenarioAction(first.runId, 'unlock-auto-submit'),
    ).toBe(false);

    const second = makeCommand('run-two');
    activateRegressionScenarioCommand(second, makeSession(second));

    expect(
      claimRegressionScenarioAction(second.runId, 'unlock-auto-submit'),
    ).toBe(true);
  });

  it('records events without invalidating React runtime subscribers', () => {
    const command = makeCommand('event-journal');
    activateRegressionScenarioCommand(command, makeSession(command));
    const listener = jest.fn();
    const unsubscribe = subscribeRegressionScenarioRuntimeControl(listener);
    const revision = getRegressionScenarioRuntimeSnapshot().revision;

    reportRegressionScenarioEvent('perf-mark', { mark: 'navigation-start' });

    const nextSnapshot = getRegressionScenarioRuntimeSnapshot();
    expect(nextSnapshot.revision).toBe(revision);
    expect(nextSnapshot.events).toEqual([
      expect.objectContaining({
        runId: command.runId,
        name: 'perf-mark',
        data: { mark: 'navigation-start' },
      }),
    ]);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('updates scenario status without invalidating React runtime subscribers', () => {
    const command = makeCommand('status-journal');
    const session = makeSession(command);
    activateRegressionScenarioCommand(command, session);
    const listener = jest.fn();
    const unsubscribe = subscribeRegressionScenarioRuntimeControl(listener);

    setRegressionScenarioRuntimeStatus('running', {
      ...session,
      status: 'running',
    });

    expect(getRegressionScenarioRuntimeSnapshot().status).toBe('running');
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('invalidates React runtime subscribers when the active command changes', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeRegressionScenarioRuntimeControl(listener);
    const command = makeCommand('control-change');

    activateRegressionScenarioCommand(command, makeSession(command));

    expect(getRegressionScenarioRuntimeControlSnapshot()).toEqual({
      enabled: false,
      command,
    });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
