import { perpsServiceApi } from '@/core/serviceApi/perps';
import { perpsStore, type PerpsState } from '@/hooks/perps/usePerpsStore';

import { buildPerpsProMarkets, type PerpsProMarket } from '../model/market';
import {
  resolveInitialPerpsProMarket,
  resolvePerpsProNavigationMarketCandidates,
} from '../model/resolveInitialMarket';
import { getPerpsProMarketSession } from '../session/perpsProMarketSession';
import { prewarmPerpsProEntryIntent } from './perpsProEntryIntent';
import { prefetchPerpsProLeverageSources } from './perpsProZeroAddressLeverageBaseline';

type PerpsProHomeWarmupState = Pick<
  PerpsState,
  'currentPerpsAccount' | 'marketData'
>;

export type PerpsProExternalNavigationIntent = {
  accountAddress?: string;
  market?: string;
  marketCandidates?: readonly string[];
};

type PerpsProHomeWarmupDependencies = {
  getCurrentAccount: typeof perpsServiceApi.getCurrentAccount;
  getLastUsedAccount: typeof perpsServiceApi.getLastUsedAccount;
  getState: () => PerpsProHomeWarmupState;
  getSessionMarketKey: () => string | null;
  prefetchLeverageSources: typeof prefetchPerpsProLeverageSources;
  prewarmEntryIntent: typeof prewarmPerpsProEntryIntent;
};

const defaultDependencies: PerpsProHomeWarmupDependencies = {
  getCurrentAccount: () => perpsServiceApi.getCurrentAccount(),
  getLastUsedAccount: () => perpsServiceApi.getLastUsedAccount(),
  getState: () => perpsStore.getState(),
  getSessionMarketKey: () => getPerpsProMarketSession().marketKey,
  prefetchLeverageSources: prefetchPerpsProLeverageSources,
  prewarmEntryIntent: prewarmPerpsProEntryIntent,
};

const resolveHomeTarget = (
  state: PerpsProHomeWarmupState,
  sessionMarketKey: string | null,
): PerpsProMarket | null =>
  resolveInitialPerpsProMarket({
    markets: buildPerpsProMarkets(state.marketData),
    sessionMarketKey,
  });

export const prewarmPerpsProHomeAffinity = async (
  dependencies: PerpsProHomeWarmupDependencies = defaultDependencies,
) => {
  const initialTarget = resolveHomeTarget(
    dependencies.getState(),
    dependencies.getSessionMarketKey(),
  );
  if (!initialTarget) {
    return false;
  }

  const [persistedCurrentAccount, persistedLastUsedAccount] = await Promise.all(
    [
      dependencies.getCurrentAccount().catch(() => null),
      dependencies.getLastUsedAccount().catch(() => null),
    ],
  );
  const latestState = dependencies.getState();
  const latestTarget = resolveHomeTarget(
    latestState,
    dependencies.getSessionMarketKey(),
  );
  if (!latestTarget) {
    return false;
  }

  const accountAddress =
    latestState.currentPerpsAccount?.address ??
    persistedCurrentAccount?.address ??
    persistedLastUsedAccount?.address ??
    null;
  await dependencies.prefetchLeverageSources(
    latestTarget.canonicalCoin,
    accountAddress,
  );
  return true;
};

export const prewarmPerpsProHomeNavigationIntent = async (
  dependencies: PerpsProHomeWarmupDependencies = defaultDependencies,
) => {
  const state = dependencies.getState();
  const target = resolveHomeTarget(state, dependencies.getSessionMarketKey());
  if (!target) {
    return false;
  }
  dependencies.prewarmEntryIntent({
    accountAddress: state.currentPerpsAccount?.address,
    market: target,
  });
  return true;
};

export const prewarmPerpsProExternalNavigationIntent = async (
  intent: PerpsProExternalNavigationIntent,
  dependencies: PerpsProHomeWarmupDependencies = defaultDependencies,
) => {
  const state = dependencies.getState();
  const markets = buildPerpsProMarkets(state.marketData);
  const target = intent.market
    ? markets.find(market => market.canonicalCoin === intent.market) ?? null
    : resolvePerpsProNavigationMarketCandidates({
        markets,
        navigationMarketCandidates: intent.marketCandidates,
      });
  if (!target) {
    return false;
  }
  dependencies.prewarmEntryIntent({
    accountAddress:
      intent.accountAddress ?? state.currentPerpsAccount?.address ?? undefined,
    market: target,
  });
  return true;
};
