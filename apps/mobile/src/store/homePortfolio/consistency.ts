import { computeBalanceChange } from '@/core/utils/balanceChange';

export type PortfolioAddressBalance = {
  totalBalance: number;
  evmBalance: number;
};

export type PortfolioAddressBalanceFallback = {
  totalBalance?: number | null;
  evmBalance?: number | null;
};

export type PortfolioAddressBalanceSource =
  | 'resource'
  | 'account-snapshot'
  | 'empty';

export type ResolvedPortfolioAddressBalance = PortfolioAddressBalance & {
  source: PortfolioAddressBalanceSource;
};

export type PortfolioAddressChangeSource = 'balance24h' | 'curve';

export type PortfolioAddressChange = {
  rawChange: number;
  changePercent: string;
  isLoss: boolean;
  currentEvmBalance: number;
  previousEvmBalance: number;
  source: PortfolioAddressChangeSource;
};

export function resolvePortfolioAddressBalance(input: {
  resource?: PortfolioAddressBalance | null;
  fallback?: PortfolioAddressBalanceFallback | null;
}): ResolvedPortfolioAddressBalance {
  if (input.resource) {
    return {
      totalBalance: input.resource.totalBalance,
      evmBalance: input.resource.evmBalance,
      source: 'resource',
    };
  }

  if (input.fallback) {
    return {
      totalBalance: input.fallback.totalBalance ?? 0,
      evmBalance: input.fallback.evmBalance ?? 0,
      source: 'account-snapshot',
    };
  }

  return {
    totalBalance: 0,
    evmBalance: 0,
    source: 'empty',
  };
}

export function buildPortfolioAddressChange(input: {
  currentEvmBalance?: number | null;
  previousEvmBalance?: number | null;
  curveStartEvmBalance?: number | null;
  allowCurveFallback?: boolean;
}): PortfolioAddressChange | undefined {
  if (typeof input.currentEvmBalance !== 'number') {
    return undefined;
  }

  const has24hBalance = typeof input.previousEvmBalance === 'number';
  const canUseCurveFallback =
    !!input.allowCurveFallback &&
    typeof input.curveStartEvmBalance === 'number';
  if (!has24hBalance && !canUseCurveFallback) {
    return undefined;
  }

  const previousEvmBalance = has24hBalance
    ? input.previousEvmBalance
    : input.curveStartEvmBalance;
  const source: PortfolioAddressChangeSource = has24hBalance
    ? 'balance24h'
    : 'curve';
  const { assetsChange, changePercent } = computeBalanceChange(
    input.currentEvmBalance,
    previousEvmBalance as number,
  );

  return {
    rawChange: assetsChange,
    changePercent,
    isLoss: assetsChange < 0,
    currentEvmBalance: input.currentEvmBalance,
    previousEvmBalance: previousEvmBalance as number,
    source,
  };
}

export function buildPortfolioAggregateChange(
  values: Array<PortfolioAddressChange | undefined>,
) {
  const comparableValues = values.filter(
    (value): value is PortfolioAddressChange =>
      !!value && value.source === 'balance24h',
  );
  if (!comparableValues.length) {
    return undefined;
  }

  const currentEvmBalance = comparableValues.reduce(
    (total, value) => total + value.currentEvmBalance,
    0,
  );
  const previousEvmBalance = comparableValues.reduce(
    (total, value) => total + value.previousEvmBalance,
    0,
  );
  const { assetsChange, changePercent } = computeBalanceChange(
    currentEvmBalance,
    previousEvmBalance,
  );

  return {
    rawChange: assetsChange,
    changePercent,
    isLoss: assetsChange < 0,
    currentEvmBalance,
    previousEvmBalance,
  };
}
