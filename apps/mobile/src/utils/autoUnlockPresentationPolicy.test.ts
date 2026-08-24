import { createAutoUnlockPresentationPolicy } from './autoUnlockPresentationPolicy';

describe('createAutoUnlockPresentationPolicy', () => {
  it('waits for an iOS opening transition to finish', () => {
    const setPresentationReady = jest.fn();
    const policy = createAutoUnlockPresentationPolicy({
      isIOS: true,
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
      setPresentationReady,
    });

    policy.onTransitionStart({ isUnlockRoute: true, closing: false });
    policy.onTransitionEnd({ isUnlockRoute: true, closing: false });

    expect(setPresentationReady.mock.calls).toEqual([[true]]);
  });

  it('keeps the initial unlock route eligible without a synthetic timeout', () => {
    const setPresentationReady = jest.fn();
    const policy = createAutoUnlockPresentationPolicy({
      isIOS: true,
      setPresentationReady,
    });

    policy.onInitialRouteReady(true);

    expect(setPresentationReady).toHaveBeenCalledWith(true);
  });

  it('clears presentation readiness as the unlock route closes', () => {
    const setPresentationReady = jest.fn();
    const policy = createAutoUnlockPresentationPolicy({
      isIOS: true,
      setPresentationReady,
    });

    policy.onTransitionStart({ isUnlockRoute: true, closing: true });
    policy.onRouteChange(false);

    expect(setPresentationReady.mock.calls).toEqual([[false], [false]]);
  });
});
