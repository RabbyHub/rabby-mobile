import { shallow } from 'zustand/shallow';

import type { PerpsState } from '@/hooks/perps/usePerpsStore';
import {
  buildPerpsAccountAssetKeys,
  buildPerpsAccountControlState,
  buildPerpsAccountViewModel,
  getSpotPriceDependencyKeys,
  getStakedHypeAmount,
  STAKING_TOKEN_NAME,
  type BuildPerpsAccountViewModelInput,
  type PerpsAccountControlState,
  type PerpsAccountViewModel,
} from '../model/account';

type AccountSummary = Pick<
  PerpsAccountViewModel,
  'primaryValue' | 'unrealizedPnl'
>;

/** One scene-local cache shared by the control plane and retained Account rows.
 * Reading control state never computes portfolio totals. Full valuation is lazy:
 * inactive Account subscribers leave source updates alone without aggregating
 * every hidden tick. All selectors read one supplied store snapshot, not facts
 * captured by a previous render/account.
 */
export const createPerpsProAccountSelectors = () => {
  let markets: PerpsState['marketData'] | undefined;
  let marketSignatures: string[] = [];
  let marketDataMap: BuildPerpsAccountViewModelInput['marketDataMap'] = {};
  let stakingSummary: PerpsState['stakingSummary'] | undefined;
  let stakingHype = '0';
  let dependencyBalances: PerpsState['spotState']['rawBalances'] | undefined;
  let dependencyMeta: PerpsState['spotMeta'] | undefined;
  let dependencyStaking: string | undefined;
  let priceKeys: string[] = [];
  let priceValues: (string | undefined)[] = [];
  let priceSource: PerpsState['spotAssetCtxs'] | undefined;
  let input: BuildPerpsAccountViewModelInput | undefined;
  let controlInput: BuildPerpsAccountViewModelInput | undefined;
  let controlValue: PerpsAccountControlState;
  let valuationInput: BuildPerpsAccountViewModelInput | undefined;
  let valuationValue: PerpsAccountViewModel;
  let summaryValue: AccountSummary;
  let assetsSource: PerpsState['spotState'] | undefined;
  let assetsMode: PerpsState['userAbstraction'] | undefined;
  let assetsValue: string[] = [];

  const readInput = (state: PerpsState): BuildPerpsAccountViewModelInput => {
    if (markets !== state.marketData) {
      markets = state.marketData;
      const signatures = markets.map(
        market =>
          `${market.name}\u0000${market.dexId}\u0000${market.quoteAsset}`,
      );
      if (!shallow(signatures, marketSignatures)) {
        marketSignatures = signatures;
        marketDataMap = {};
        for (const market of markets) {
          const { name: coin, dexId, quoteAsset } = market;
          if (
            coin &&
            (quoteAsset === 'USDC' ||
              quoteAsset === 'USDT' ||
              quoteAsset === 'USDH' ||
              quoteAsset === 'USDE')
          ) {
            marketDataMap[coin] = { coin, dexId: dexId || '', quoteAsset };
          }
        }
      }
    }
    if (stakingSummary !== state.stakingSummary) {
      stakingSummary = state.stakingSummary;
      stakingHype = getStakedHypeAmount(stakingSummary);
    }
    const dependenciesChanged =
      dependencyBalances !== state.spotState.rawBalances ||
      dependencyMeta !== state.spotMeta ||
      dependencyStaking !== stakingHype;
    if (dependenciesChanged) {
      dependencyBalances = state.spotState.rawBalances;
      dependencyMeta = state.spotMeta;
      dependencyStaking = stakingHype;
      priceKeys = getSpotPriceDependencyKeys(
        [
          // Zero-balance asset rows still distinguish unavailable USD value
          // from a priced zero. Readiness itself only checks nonzero holdings.
          ...dependencyBalances.map(balance => balance.coin),
          ...(Number(stakingHype) > 0 ? [STAKING_TOKEN_NAME] : []),
        ],
        dependencyMeta,
      );
    }
    let pricesChanged = dependenciesChanged;
    if (dependenciesChanged || priceSource !== state.spotAssetCtxs) {
      priceSource = state.spotAssetCtxs;
      const nextPrices = priceKeys.map(key => priceSource?.[key]?.markPx);
      pricesChanged ||= !shallow(priceValues, nextPrices);
      priceValues = nextPrices;
    }
    if (
      !input ||
      pricesChanged ||
      input.clearinghouseState !== state.currentClearinghouseState ||
      input.marketDataMap !== marketDataMap ||
      input.spotMeta !== state.spotMeta ||
      input.spotState !== state.spotState ||
      input.stakingHype !== stakingHype ||
      input.userAbstraction !== state.userAbstraction
    ) {
      input = {
        clearinghouseState: state.currentClearinghouseState,
        marketDataMap,
        spotAssetCtxs: state.spotAssetCtxs,
        spotMeta: state.spotMeta,
        spotState: state.spotState,
        stakingHype,
        userAbstraction: state.userAbstraction,
      };
    }
    return input;
  };

  const valuation = (state: PerpsState) => {
    const nextInput = readInput(state);
    if (valuationInput !== nextInput) {
      valuationValue = buildPerpsAccountViewModel(nextInput);
      valuationInput = nextInput;
      const nextSummary = {
        primaryValue: valuationValue.primaryValue,
        unrealizedPnl: valuationValue.unrealizedPnl,
      };
      if (!shallow(summaryValue, nextSummary)) {
        summaryValue = nextSummary;
      }
    }
    return valuationValue;
  };

  return {
    control: (state: PerpsState) => {
      const nextInput = readInput(state);
      if (controlInput !== nextInput) {
        const nextControl = buildPerpsAccountControlState(nextInput);
        if (!shallow(controlValue, nextControl)) {
          controlValue = nextControl;
        }
        controlInput = nextInput;
      }
      return controlValue;
    },
    assetKeys: (state: PerpsState) => {
      if (
        assetsSource !== state.spotState ||
        assetsMode !== state.userAbstraction
      ) {
        assetsSource = state.spotState;
        assetsMode = state.userAbstraction;
        const nextKeys = buildPerpsAccountAssetKeys({
          spotState: assetsSource,
          userAbstraction: assetsMode,
        });
        if (!shallow(assetsValue, nextKeys)) {
          assetsValue = nextKeys;
        }
      }
      return assetsValue;
    },
    valuation,
    summary: (state: PerpsState) => {
      valuation(state);
      return summaryValue;
    },
  };
};

export type PerpsProAccountSelectors = ReturnType<
  typeof createPerpsProAccountSelectors
>;
