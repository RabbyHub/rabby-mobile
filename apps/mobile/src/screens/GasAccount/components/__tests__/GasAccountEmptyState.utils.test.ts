import { getGasAccountEmptyStatePrimaryMode } from '../GasAccountEmptyState.utils';

describe('GasAccountEmptyState utils', () => {
  it('uses claimGift only for logged-out users without pending hardware account and with an eligible gift address', () => {
    expect(
      getGasAccountEmptyStatePrimaryMode({
        isLogin: false,
        hasPendingHardwareAccount: false,
        hasEligibleGiftAddress: true,
      }),
    ).toBe('claimGift');
  });

  it.each([
    {
      isLogin: true,
      hasPendingHardwareAccount: false,
      hasEligibleGiftAddress: true,
    },
    {
      isLogin: false,
      hasPendingHardwareAccount: true,
      hasEligibleGiftAddress: true,
    },
    {
      isLogin: false,
      hasPendingHardwareAccount: false,
      hasEligibleGiftAddress: false,
    },
    {
      isLogin: true,
      hasPendingHardwareAccount: true,
      hasEligibleGiftAddress: false,
    },
  ])('uses deposit for non-claimable state %#', state => {
    expect(getGasAccountEmptyStatePrimaryMode(state)).toBe('deposit');
  });
});
