import {
  WalletUnlockCancelledError,
  isWalletUnlockCancelled,
} from './walletUnlockError';

describe('walletUnlockError', () => {
  it('creates a named cancellation error', () => {
    const error = new WalletUnlockCancelledError();

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('WalletUnlockCancelledError');
    expect(error.message).toBe('Wallet unlock cancelled');
  });

  it('recognizes cancellation errors across Error instances and serialized shapes', () => {
    expect(isWalletUnlockCancelled(new WalletUnlockCancelledError())).toBe(
      true,
    );
    expect(
      isWalletUnlockCancelled({
        name: 'WalletUnlockCancelledError',
      }),
    ).toBe(true);
    expect(isWalletUnlockCancelled(new Error('Wallet unlock cancelled'))).toBe(
      false,
    );
    expect(isWalletUnlockCancelled(null)).toBe(false);
  });
});
