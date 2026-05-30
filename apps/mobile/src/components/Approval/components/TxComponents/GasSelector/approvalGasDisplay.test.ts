import {
  getApprovalGasMethodLabel,
  isApprovalGasMethodNotEnough,
  isApprovalSmartGasDisplayEnabled,
  resolveApprovalDisplayedGasLevelNotEnough,
  resolveApprovalGasLevelMethod,
  resolveApprovalGasMethod,
  shouldAutoSwitchToApprovalGasAccount,
  shouldHideApprovalGasMethodTabs,
  shouldUseLegacyApprovalFooterAutoSwitch,
} from './approvalGasDisplay';

describe('approvalGasDisplay', () => {
  it('keeps legacy mode behavior explicit', () => {
    expect(isApprovalSmartGasDisplayEnabled('legacy')).toBe(false);
    expect(shouldHideApprovalGasMethodTabs('legacy')).toBe(false);
    expect(shouldUseLegacyApprovalFooterAutoSwitch('legacy')).toBe(true);

    expect(
      resolveApprovalGasMethod({
        mode: 'legacy',
        nativeTokenInsufficient: true,
        gasAccountChainSupported: true,
        legacyGasMethod: 'gasAccount',
      }),
    ).toBe('gasAccount');
  });

  it('uses smart display mode to hide manual method tabs', () => {
    const mode = 'native_insufficient_prefers_gasAccount';

    expect(isApprovalSmartGasDisplayEnabled(mode)).toBe(true);
    expect(shouldHideApprovalGasMethodTabs(mode)).toBe(true);
    expect(shouldUseLegacyApprovalFooterAutoSwitch(mode)).toBe(false);
  });

  it('auto switches to GasAccount only when native gas is insufficient and supported', () => {
    expect(
      shouldAutoSwitchToApprovalGasAccount({
        nativeTokenInsufficient: true,
        gasAccountChainSupported: true,
      }),
    ).toBe(true);

    expect(
      shouldAutoSwitchToApprovalGasAccount({
        nativeTokenInsufficient: false,
        gasAccountChainSupported: true,
      }),
    ).toBe(false);
    expect(
      shouldAutoSwitchToApprovalGasAccount({
        nativeTokenInsufficient: true,
        gasAccountChainSupported: false,
      }),
    ).toBe(false);
    expect(
      shouldAutoSwitchToApprovalGasAccount({
        nativeTokenInsufficient: true,
        gasAccountChainSupported: true,
        freeGasAvailable: true,
      }),
    ).toBe(false);
    expect(
      shouldAutoSwitchToApprovalGasAccount({
        nativeTokenInsufficient: true,
        gasAccountChainSupported: true,
        noCustomRPC: false,
      }),
    ).toBe(false);
  });

  it('resolves smart display method from native gas and GasAccount availability', () => {
    const mode = 'native_insufficient_prefers_gasAccount';

    expect(
      resolveApprovalGasMethod({
        mode,
        nativeTokenInsufficient: true,
        gasAccountChainSupported: true,
      }),
    ).toBe('gasAccount');
    expect(
      resolveApprovalGasMethod({
        mode,
        nativeTokenInsufficient: true,
        gasAccountChainSupported: true,
        freeGasAvailable: true,
      }),
    ).toBe('native');
    expect(
      resolveApprovalGasMethod({
        mode,
        nativeTokenInsufficient: false,
        gasAccountChainSupported: true,
      }),
    ).toBe('native');
  });

  it('does not rewrite custom gas levels while editing a custom level', () => {
    expect(
      resolveApprovalGasLevelMethod({
        mode: 'native_insufficient_prefers_gasAccount',
        isCustom: true,
        nativeTokenInsufficient: true,
        gasAccountChainSupported: true,
        currentGasMethod: 'native',
      }),
    ).toBe('native');

    expect(
      resolveApprovalGasLevelMethod({
        mode: 'native_insufficient_prefers_gasAccount',
        isCustom: false,
        nativeTokenInsufficient: true,
        gasAccountChainSupported: true,
        currentGasMethod: 'native',
      }),
    ).toBe('gasAccount');
  });

  it('calculates not-enough state for the displayed gas method', () => {
    expect(
      isApprovalGasMethodNotEnough({
        displayMethod: 'native',
        nativeTokenInsufficient: true,
      }),
    ).toBe(true);
    expect(
      isApprovalGasMethodNotEnough({
        displayMethod: 'gasAccount',
        nativeTokenInsufficient: true,
        gasAccountBalanceEnough: true,
      }),
    ).toBe(false);
    expect(
      isApprovalGasMethodNotEnough({
        displayMethod: 'gasAccount',
        nativeTokenInsufficient: false,
        gasAccountBalanceEnough: false,
      }),
    ).toBe(true);
  });

  it('uses active method state for the selected level and cached level flags otherwise', () => {
    expect(
      resolveApprovalDisplayedGasLevelNotEnough({
        isActive: true,
        displayMethod: 'gasAccount',
        nativeTokenInsufficient: true,
        gasAccountBalanceEnough: false,
        levelNativeInsufficient: false,
        levelGasAccountNotEnough: false,
      }),
    ).toBe(true);

    expect(
      resolveApprovalDisplayedGasLevelNotEnough({
        isActive: false,
        displayMethod: 'gasAccount',
        nativeTokenInsufficient: false,
        gasAccountBalanceEnough: true,
        levelGasAccountNotEnough: true,
      }),
    ).toBe(true);

    expect(
      resolveApprovalDisplayedGasLevelNotEnough({
        isActive: false,
        displayMethod: 'native',
        nativeTokenInsufficient: false,
        gasAccountBalanceEnough: false,
        levelNativeInsufficient: true,
      }),
    ).toBe(true);
  });

  it('labels gas methods consistently for headers', () => {
    expect(getApprovalGasMethodLabel('native')).toBe('Native');
    expect(getApprovalGasMethodLabel('gasAccount')).toBe('GasAccount');
  });
});
