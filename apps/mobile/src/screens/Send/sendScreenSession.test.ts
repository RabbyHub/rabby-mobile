import {
  claimSendScreenSession,
  getSendScreenActivationPlan,
  isSendScreenSessionActive,
  releaseSendScreenSession,
  resetSendScreenSessionForTests,
} from './sendScreenSession';

describe('Send screen session ownership', () => {
  beforeEach(() => {
    resetSendScreenSessionForTests();
  });

  it('keeps the same session while the same Send route remains the owner', () => {
    const firstClaim = claimSendScreenSession('send-a');
    const secondClaim = claimSendScreenSession('send-a');

    expect(firstClaim.ownerChanged).toBe(true);
    expect(secondClaim.ownerChanged).toBe(false);
    expect(secondClaim.session).toBe(firstClaim.session);
    expect(isSendScreenSessionActive(firstClaim.session)).toBe(true);
  });

  it('invalidates an older Send route when a nested Send route takes ownership', () => {
    const firstSend = claimSendScreenSession('send-a').session;
    const nestedSend = claimSendScreenSession('send-b').session;

    expect(isSendScreenSessionActive(firstSend)).toBe(false);
    expect(isSendScreenSessionActive(nestedSend)).toBe(true);
  });

  it('does not let an out-of-order unmount release the reactivated Send route', () => {
    const firstSend = claimSendScreenSession('send-a').session;
    const nestedSend = claimSendScreenSession('send-b').session;
    const reactivatedFirstSend = claimSendScreenSession('send-a').session;

    expect(reactivatedFirstSend).not.toBe(firstSend);
    expect(releaseSendScreenSession(nestedSend)).toBe(false);
    expect(isSendScreenSessionActive(reactivatedFirstSend)).toBe(true);
    expect(releaseSendScreenSession(reactivatedFirstSend)).toBe(true);
    expect(isSendScreenSessionActive(reactivatedFirstSend)).toBe(false);
  });

  it('restarts initialization only when shared state was reset or ownership changed', () => {
    expect(
      getSendScreenActivationPlan({
        hadClaimedSession: true,
        ownerChanged: false,
        screenStateInited: true,
      }),
    ).toEqual({
      resetSharedState: false,
      restartInitialization: false,
    });

    expect(
      getSendScreenActivationPlan({
        hadClaimedSession: true,
        ownerChanged: true,
        screenStateInited: true,
      }),
    ).toEqual({
      resetSharedState: true,
      restartInitialization: true,
    });

    expect(
      getSendScreenActivationPlan({
        hadClaimedSession: true,
        ownerChanged: false,
        screenStateInited: false,
      }),
    ).toEqual({
      resetSharedState: false,
      restartInitialization: true,
    });
  });
});
