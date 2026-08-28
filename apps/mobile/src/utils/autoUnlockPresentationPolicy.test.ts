import { createAutoUnlockPresentationPolicy } from './autoUnlockPresentationPolicy';

describe('createAutoUnlockPresentationPolicy', () => {
  it('waits for an iOS opening transition to finish', () => {
    const setPresentationReady = jest.fn();
    const policy = createAutoUnlockPresentationPolicy({
      isIOS: true,
      bootSplashExited: true,
      setPresentationReady,
    });

    policy.onTransitionStart({ isUnlockRoute: true, closing: false });
    policy.onTransitionEnd({ isUnlockRoute: true, closing: false });

    expect(setPresentationReady.mock.calls).toEqual([[false], [true]]);
  });

  it('does not add an Android transition delay', () => {
    const setPresentationReady = jest.fn();
    const policy = createAutoUnlockPresentationPolicy({
      isIOS: false,
      bootSplashExited: false,
      setPresentationReady,
    });

    policy.onTransitionStart({ isUnlockRoute: true, closing: false });
    policy.onTransitionEnd({ isUnlockRoute: true, closing: false });

    expect(setPresentationReady.mock.calls).toEqual([[true]]);
  });

  it('waits for the iOS boot splash to leave the initial unlock route', () => {
    const setPresentationReady = jest.fn();
    const policy = createAutoUnlockPresentationPolicy({
      isIOS: true,
      bootSplashExited: false,
      setPresentationReady,
    });

    policy.onInitialRouteReady(true);
    policy.onBootSplashExited(true);

    expect(setPresentationReady.mock.calls).toEqual([[false], [true]]);
  });

  it('clears presentation readiness as the unlock route closes', () => {
    const setPresentationReady = jest.fn();
    const policy = createAutoUnlockPresentationPolicy({
      isIOS: true,
      bootSplashExited: true,
      setPresentationReady,
    });

    policy.onTransitionStart({ isUnlockRoute: true, closing: true });
    policy.onRouteChange(false);

    expect(setPresentationReady.mock.calls).toEqual([[false], [false]]);
  });
});
