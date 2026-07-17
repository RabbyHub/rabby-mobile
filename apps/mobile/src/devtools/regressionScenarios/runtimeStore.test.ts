import type {
  RegressionScenarioCommand,
  RegressionScenarioSession,
} from './contracts';
import {
  activateRegressionScenarioCommand,
  claimRegressionScenarioAction,
  clearRegressionScenarioRuntime,
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
});
