import {
  registerRegressionScenarioComponentAction,
  runRegressionScenarioComponentAction,
} from './componentActions.nonprod';

describe('regression scenario component actions', () => {
  it('waits for an asynchronous component action to finish', async () => {
    let completed = false;
    const unregister = registerRegressionScenarioComponentAction(
      'async-action-run',
      'async-action',
      async () => {
        await new Promise<void>(resolve => setTimeout(resolve, 10));
        completed = true;
      },
    );

    const timing = await runRegressionScenarioComponentAction(
      'async-action-run',
      'async-action',
      100,
    );

    expect(completed).toBe(true);
    expect(timing.waitMs).toBeGreaterThanOrEqual(0);
    expect(timing.handlerMs).toBeGreaterThan(0);
    expect(timing.totalMs).toBe(timing.waitMs + timing.handlerMs);
    unregister();
  });

  it('times out when a registered component action stays pending', async () => {
    const unregister = registerRegressionScenarioComponentAction(
      'pending-action-run',
      'pending-action',
      () => new Promise<void>(() => undefined),
    );

    await expect(
      runRegressionScenarioComponentAction(
        'pending-action-run',
        'pending-action',
        20,
      ),
    ).rejects.toThrow('Timed out running component action: pending-action');
    unregister();
  });

  it('retains the registration timeout error for missing actions', async () => {
    await expect(
      runRegressionScenarioComponentAction(
        'missing-action-run',
        'missing-action',
        20,
      ),
    ).rejects.toThrow('Timed out waiting for component action: missing-action');
  });
});
