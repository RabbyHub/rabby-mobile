const WALLET_UNLOCK_CANCELLED_ERROR_NAME = 'WalletUnlockCancelledError';
const WALLET_UNLOCK_CANCELLED_ERROR_MESSAGE = 'Wallet unlock cancelled';

export class WalletUnlockCancelledError extends Error {
  constructor() {
    super(WALLET_UNLOCK_CANCELLED_ERROR_MESSAGE);
    this.name = WALLET_UNLOCK_CANCELLED_ERROR_NAME;
  }
}

export function isWalletUnlockCancelled(error: unknown) {
  return (
    error instanceof WalletUnlockCancelledError ||
    (error as Error | undefined)?.name === WALLET_UNLOCK_CANCELLED_ERROR_NAME
  );
}
