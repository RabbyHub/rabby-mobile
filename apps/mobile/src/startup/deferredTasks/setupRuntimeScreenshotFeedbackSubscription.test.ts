type ScreenshotSubscriptionModule =
  typeof import('./setupRuntimeScreenshotFeedbackSubscription');

function loadSubscriptionModule() {
  jest.resetModules();
  const startSubscribe = jest.fn<Promise<{ remove: () => void }>, []>();
  jest.doMock('@/components/Screenshot/hooks', () => ({
    startSubscribeUserDidTakeScreenshot: startSubscribe,
  }));

  let module: ScreenshotSubscriptionModule | undefined;
  jest.isolateModules(() => {
    module = require('./setupRuntimeScreenshotFeedbackSubscription');
  });

  return { module: module!, startSubscribe };
}

describe('screenshot feedback startup', () => {
  it('waits for subscription readiness and shares concurrent startup calls', async () => {
    const { module, startSubscribe } = loadSubscriptionModule();
    let resolveSubscription!: (subscription: { remove: () => void }) => void;
    startSubscribe.mockReturnValue(
      new Promise(resolve => {
        resolveSubscription = resolve;
      }),
    );

    const first = module.startSetupRuntimeScreenshotFeedbackSubscription();
    const concurrent = module.startSetupRuntimeScreenshotFeedbackSubscription();
    expect(concurrent).toBe(first);
    let ready = false;
    first.then(() => {
      ready = true;
    });
    await Promise.resolve();
    expect(ready).toBe(false);

    resolveSubscription({ remove: jest.fn() });
    await first;
    await module.startSetupRuntimeScreenshotFeedbackSubscription();
    expect(ready).toBe(true);
    expect(startSubscribe).toHaveBeenCalledTimes(1);
  });

  it('allows a failed initialization or native subscription to retry', async () => {
    const { module, startSubscribe } = loadSubscriptionModule();
    const error = new Error('screenshot capture is not ready');
    startSubscribe
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ remove: jest.fn() });

    await expect(
      module.startSetupRuntimeScreenshotFeedbackSubscription(),
    ).rejects.toBe(error);
    await module.startSetupRuntimeScreenshotFeedbackSubscription();

    expect(startSubscribe).toHaveBeenCalledTimes(2);
  });
});
