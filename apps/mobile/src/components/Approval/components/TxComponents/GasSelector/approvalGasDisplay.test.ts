import {
  isApprovalSmartGasDisplayEnabled,
  resolveApprovalGasMethod,
  shouldAutoSwitchToApprovalGasAccount,
  shouldHideApprovalGasMethodTabs,
  shouldUseLegacyApprovalFooterAutoSwitch,
} from './approvalGasDisplay';

describe('approval gas display', () => {
  it('keeps manual gas method selection visible by default', () => {
    expect(isApprovalSmartGasDisplayEnabled()).toBe(false);
    expect(shouldHideApprovalGasMethodTabs()).toBe(false);
    expect(shouldUseLegacyApprovalFooterAutoSwitch()).toBe(true);
  });

  it('keeps the native-insufficient auto switch condition available', () => {
    expect(
      shouldAutoSwitchToApprovalGasAccount({
        nativeTokenInsufficient: true,
        gasAccountChainSupported: true,
        noCustomRPC: true,
        freeGasAvailable: false,
      }),
    ).toBe(true);
  });

  it('uses the selected gas method in legacy mode', () => {
    const baseParams = {
      nativeTokenInsufficient: true,
      gasAccountChainSupported: true,
      noCustomRPC: true,
      freeGasAvailable: false,
    };

    expect(
      resolveApprovalGasMethod({
        ...baseParams,
        legacyGasMethod: 'native',
      }),
    ).toBe('native');
    expect(
      resolveApprovalGasMethod({
        ...baseParams,
        legacyGasMethod: 'gasAccount',
      }),
    ).toBe('gasAccount');
  });

  it('still supports smart gas account resolution when explicitly requested', () => {
    expect(
      resolveApprovalGasMethod({
        mode: 'native_insufficient_prefers_gasAccount',
        nativeTokenInsufficient: true,
        gasAccountChainSupported: true,
        noCustomRPC: true,
        freeGasAvailable: false,
        legacyGasMethod: 'native',
      }),
    ).toBe('gasAccount');
  });
});
