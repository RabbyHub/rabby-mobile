import {
  isHomeProjectionWaitingForValue,
  type Home24hProjection,
  type HomeAccountProjection,
  type HomeBalanceProjection,
} from './model';

export type HomeContentReadinessBlocker =
  | 'account_context'
  | 'balance'
  | 'change_24h';

export type HomeContentReadinessProjection = {
  isReady: boolean;
  settledSelectionGeneration?: number;
  blockingReasons: HomeContentReadinessBlocker[];
};

export function createInitialHomeContentReadinessProjection(): HomeContentReadinessProjection {
  return {
    isReady: false,
    blockingReasons: ['account_context', 'balance', 'change_24h'],
  };
}

export function reduceHomeContentReadinessProjection(
  previous: HomeContentReadinessProjection,
  input: {
    account: HomeAccountProjection;
    balance: HomeBalanceProjection;
    change24h: Home24hProjection;
  },
): HomeContentReadinessProjection {
  if (previous.isReady) {
    return previous;
  }

  const blockingReasons: HomeContentReadinessBlocker[] = [];
  if (!input.account.hasResolvedAccountContext) {
    blockingReasons.push('account_context');
  }
  if (isHomeProjectionWaitingForValue(input.balance.availability)) {
    blockingReasons.push('balance');
  }
  if (isHomeProjectionWaitingForValue(input.change24h.availability)) {
    blockingReasons.push('change_24h');
  }

  if (!blockingReasons.length) {
    return {
      isReady: true,
      settledSelectionGeneration: input.account.selectionGeneration,
      blockingReasons: [],
    };
  }

  const isSame =
    previous.blockingReasons.length === blockingReasons.length &&
    previous.blockingReasons.every(
      (reason, index) => reason === blockingReasons[index],
    );

  return isSame ? previous : { ...previous, blockingReasons };
}
