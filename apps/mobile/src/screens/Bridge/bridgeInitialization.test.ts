import { createBridgeInitializationController } from './bridgeInitialization';

describe('Bridge initialization controller', () => {
  it('deduplicates a running or completed initialization for the same inputs', () => {
    const controller = createBridgeInitializationController();
    const run = controller.begin('account-a|route-a');

    expect(run).not.toBeNull();
    expect(controller.begin('account-a|route-a')).toBeNull();
    expect(controller.complete(run!)).toBe(true);
    expect(controller.begin('account-a|route-a')).toBeNull();
    expect(controller.getSnapshot().status).toBe('ready');
  });

  it('rejects stale commits after initialization inputs change', () => {
    const controller = createBridgeInitializationController();
    const oldRun = controller.begin('account-a|route-a')!;
    const currentRun = controller.begin('account-b|route-a')!;

    expect(controller.isCurrent(oldRun)).toBe(false);
    expect(controller.complete(oldRun)).toBe(false);
    expect(controller.complete(currentRun)).toBe(true);
    expect(controller.getSnapshot()).toMatchObject({
      key: 'account-b|route-a',
      status: 'ready',
    });
  });

  it('retries failed work and invalidates work cancelled while inactive', () => {
    const controller = createBridgeInitializationController();
    const failedRun = controller.begin('account-a|route-a')!;

    expect(controller.fail(failedRun)).toBe(true);
    const retryRun = controller.begin('account-a|route-a')!;
    expect(retryRun.generation).toBeGreaterThan(failedRun.generation);

    expect(controller.cancel(retryRun)).toBe(true);
    expect(controller.isCurrent(retryRun)).toBe(false);
    expect(controller.begin('account-a|route-a')).not.toBeNull();
  });
});
