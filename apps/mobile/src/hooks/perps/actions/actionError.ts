import { isWalletUnlockCancelled } from '@/utils/walletUnlockError';

export class PerpsActionUserCancelledError extends Error {
  constructor() {
    super('Canceled');
    this.name = 'PerpsActionUserCancelledError';
  }
}

export const isPerpsActionUserCancelled = (error: unknown): boolean =>
  error === 'Canceled' ||
  error instanceof PerpsActionUserCancelledError ||
  isWalletUnlockCancelled(error);
