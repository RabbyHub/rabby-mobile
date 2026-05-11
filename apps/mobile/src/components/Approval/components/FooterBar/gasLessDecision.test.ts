import { resolveGasAccountAutoSwitchOnce } from './gasLessDecision';

describe('resolveGasAccountAutoSwitchOnce', () => {
  it('auto-switches only once while native gas is insufficient', () => {
    const firstDecision = resolveGasAccountAutoSwitchOnce({
      shouldAutoSwitch: true,
      payGasByGasAccount: false,
      hasAutoSwitched: false,
    });

    expect(firstDecision).toEqual({
      shouldSwitch: true,
      nextHasAutoSwitched: true,
    });

    const manualNativeDecision = resolveGasAccountAutoSwitchOnce({
      shouldAutoSwitch: true,
      payGasByGasAccount: false,
      hasAutoSwitched: firstDecision.nextHasAutoSwitched,
    });

    expect(manualNativeDecision).toEqual({
      shouldSwitch: false,
      nextHasAutoSwitched: true,
    });
  });

  it('treats an already selected gas account as the initial auto-switch', () => {
    const alreadyGasAccountDecision = resolveGasAccountAutoSwitchOnce({
      shouldAutoSwitch: true,
      payGasByGasAccount: true,
      hasAutoSwitched: false,
    });

    expect(alreadyGasAccountDecision).toEqual({
      shouldSwitch: false,
      nextHasAutoSwitched: true,
    });

    expect(
      resolveGasAccountAutoSwitchOnce({
        shouldAutoSwitch: true,
        payGasByGasAccount: false,
        hasAutoSwitched: alreadyGasAccountDecision.nextHasAutoSwitched,
      }),
    ).toEqual({
      shouldSwitch: false,
      nextHasAutoSwitched: true,
    });
  });

  it('resets once the auto-switch condition is gone', () => {
    expect(
      resolveGasAccountAutoSwitchOnce({
        shouldAutoSwitch: false,
        payGasByGasAccount: false,
        hasAutoSwitched: true,
      }),
    ).toEqual({
      shouldSwitch: false,
      nextHasAutoSwitched: false,
    });
  });
});
