import type { RegressionScenarioCommand } from './contracts';
import {
  makeScreenContext,
  type RegressionScreenContextRuntime,
} from './screenContext';

const command: RegressionScenarioCommand = {
  mode: 'lifecycle-e2e',
  action: 'open',
  commandId: 'send-receive.open.test',
  runId: 'send-receive-focus-guard-test',
  scenario: 'send-receive',
  credentialProfile: 'regression-default',
  persistAcrossLaunches: false,
  expiresAt: Date.now() + 60_000,
  remainingLaunches: 1,
  params: {},
};

function createRuntime(): RegressionScreenContextRuntime {
  const claims = new Set<string>();
  return {
    scenarioIncludesScreen: (scenario, screen) =>
      scenario === 'send-receive' &&
      (screen === 'Send' || screen === 'Receive'),
    claimAction: (runId, actionKey) => {
      const key = `${runId}:${actionKey}`;
      if (claims.has(key)) {
        return false;
      }
      claims.add(key);
      return true;
    },
    report: jest.fn(),
  };
}

describe('regression scenario screen context', () => {
  it('does not activate a matching screen while it is hidden', () => {
    expect(
      makeScreenContext('Send', true, command, () => false, createRuntime()),
    ).toEqual({ active: false });
  });

  it('allows claims only while the owning screen remains focused', () => {
    let focused = true;
    const context = makeScreenContext('Send', true, command, () => focused, {
      ...createRuntime(),
    });

    expect(context.active).toBe(true);
    if (!context.active) {
      throw new Error('Expected active regression context');
    }

    focused = false;
    expect(context.claimOnce('focused-action')).toBe(false);

    focused = true;
    expect(context.claimOnce('focused-action')).toBe(true);
    expect(context.claimOnce('focused-action')).toBe(false);
  });

  it('does not activate a screen outside the scenario contract', () => {
    expect(
      makeScreenContext(
        'SwapBridge',
        true,
        command,
        () => true,
        createRuntime(),
      ),
    ).toEqual({ active: false });
  });
});
