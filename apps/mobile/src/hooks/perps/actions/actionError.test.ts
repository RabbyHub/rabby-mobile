import { ExternalSignUserCancelledError } from '@rabby-wallet/hyperliquid-sdk';

import { WalletUnlockCancelledError } from '@/utils/walletUnlockError';

import {
  isPerpsActionUserCancelled,
  PerpsActionUserCancelledError,
} from './actionError';

describe('Perps action cancellation', () => {
  it.each([
    'Canceled',
    new PerpsActionUserCancelledError(),
    new WalletUnlockCancelledError(),
    new ExternalSignUserCancelledError(),
  ])('recognizes cancellation shape %#', error => {
    expect(isPerpsActionUserCancelled(error)).toBe(true);
  });

  it('does not classify ordinary signing failures as cancellation', () => {
    expect(isPerpsActionUserCancelled(new Error('signer offline'))).toBe(false);
  });
});
