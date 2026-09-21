import type { Home24hProjection, HomeBalanceProjection } from './model';
import type { HomeCurveProjection } from './curve';

export type HomeRefreshProjection = {
  selectionSignature: string;
  selectionGeneration: number;
  isBalanceFetchingRemote: boolean;
  is24hChangeFetchingRemote: boolean;
  isCurveFetchingRemote: boolean;
  isAnyRemoteRefreshing: boolean;
};

export function buildHomeRefreshProjection(input: {
  balance: HomeBalanceProjection;
  change24h: Home24hProjection;
  curve: HomeCurveProjection;
}): HomeRefreshProjection {
  const isBalanceFetchingRemote = input.balance.activity.isFetchingRemote;
  const is24hChangeFetchingRemote = input.change24h.activity.isFetchingRemote;
  const isCurveFetchingRemote = input.curve.activity.isFetchingRemote;

  return {
    selectionSignature: input.balance.selectionSignature,
    selectionGeneration: input.balance.selectionGeneration,
    isBalanceFetchingRemote,
    is24hChangeFetchingRemote,
    isCurveFetchingRemote,
    isAnyRemoteRefreshing:
      isBalanceFetchingRemote ||
      is24hChangeFetchingRemote ||
      isCurveFetchingRemote,
  };
}

export function areHomeRefreshProjectionsEqual(
  previous: HomeRefreshProjection,
  next: HomeRefreshProjection,
) {
  return (
    previous.selectionSignature === next.selectionSignature &&
    previous.selectionGeneration === next.selectionGeneration &&
    previous.isBalanceFetchingRemote === next.isBalanceFetchingRemote &&
    previous.is24hChangeFetchingRemote === next.is24hChangeFetchingRemote &&
    previous.isCurveFetchingRemote === next.isCurveFetchingRemote &&
    previous.isAnyRemoteRefreshing === next.isAnyRemoteRefreshing
  );
}
