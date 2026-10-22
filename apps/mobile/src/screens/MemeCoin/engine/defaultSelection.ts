import { ETH_MAINNET_SERVER_ID } from './constants';
import { compareText, tokenKey } from './keys';
import { planBuy } from './planner';
import type {
  ChainGasInfo,
  MemeTarget,
  PaymentAsset,
  PlanResult,
} from './types';

export type PickDefaultPaymentAssetParams = {
  assets: PaymentAsset[];
  memes: MemeTarget[];
  amountUsd: number;
  chainGas: Record<string, ChainGasInfo>;
  gasAccountBalanceUsd: number;
};

const crossLegCount = (plan: PlanResult) =>
  plan.legs.filter(l => l.kind === 'bridge').length;

const mainnetCrossLegCount = (plan: PlanResult) =>
  plan.legs.filter(
    l => l.kind === 'bridge' && l.pay.chain === ETH_MAINNET_SERVER_ID,
  ).length;

export const pickDefaultPaymentAsset = ({
  assets,
  memes,
  amountUsd,
  chainGas,
  gasAccountBalanceUsd,
}: PickDefaultPaymentAssetParams): PaymentAsset | null => {
  const memeChains = new Set(memes.map(m => m.chain));
  const sameChainRank = (a: PaymentAsset) => (memeChains.has(a.chain) ? 0 : 1);

  const [best] = assets
    .map(asset => ({
      asset,
      plan: planBuy({
        amountUsd,
        memes,
        sources: [asset],
        chainGas,
        gasAccountBalanceUsd,
      }),
    }))
    .filter(
      ({ plan }) =>
        plan.legs.length > 0 &&
        plan.shortfallUsd === 0 &&
        plan.legs.every(l => l.gasPayer !== 'risk'),
    )
    .sort(
      (a, b) =>
        sameChainRank(a.asset) - sameChainRank(b.asset) ||
        crossLegCount(a.plan) - crossLegCount(b.plan) ||
        (a.asset.isMainstream ? 0 : 1) - (b.asset.isMainstream ? 0 : 1) ||
        mainnetCrossLegCount(a.plan) - mainnetCrossLegCount(b.plan) ||
        b.asset.usdValue - a.asset.usdValue ||
        compareText(tokenKey(a.asset), tokenKey(b.asset)),
    );

  return best?.asset ?? null;
};
