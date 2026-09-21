import { isWalletUnlockCancelled } from '@/utils/walletUnlockError';
import { ExternalSignUserCancelledError } from '@rabby-wallet/hyperliquid-sdk';

export class PerpsActionUserCancelledError extends Error {
  constructor() {
    super('Canceled');
    this.name = 'PerpsActionUserCancelledError';
  }
}

export const isPerpsActionUserCancelled = (error: unknown): boolean =>
  error === 'Canceled' ||
  error instanceof PerpsActionUserCancelledError ||
  error instanceof ExternalSignUserCancelledError ||
  isWalletUnlockCancelled(error);
