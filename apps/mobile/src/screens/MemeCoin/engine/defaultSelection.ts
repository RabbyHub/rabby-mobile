import { ETH_MAINNET_SERVER_ID } from './constants';
import { compareText, tokenKey } from './keys';
import { planBuy } from './planner';
import type {
  ChainGasInfo,
  MemeTarget,
  PaymentAsset,
  PlanResult,
} from './types';

export type PickDefaultPaymentAssetsParams = {
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

const canComplete = (plan: PlanResult) =>
  plan.legs.length > 0 &&
  plan.shortfallUsd === 0 &&
  plan.legs.every(l => l.gasPayer !== 'risk');

/**
 * One asset that can pay everything alone when there is one; otherwise the
 * assets the planner uses when given all of them; otherwise nothing.
 */
export const pickDefaultPaymentAssets = ({
  assets,
  memes,
  amountUsd,
  chainGas,
  gasAccountBalanceUsd,
}: PickDefaultPaymentAssetsParams): PaymentAsset[] => {
  const memeChains = new Set(memes.map(m => m.chain));
  const sameChainRank = (a: PaymentAsset) => (memeChains.has(a.chain) ? 0 : 1);
  const planWith = (sources: PaymentAsset[]) =>
    planBuy({ amountUsd, memes, sources, chainGas, gasAccountBalanceUsd });

  const [best] = assets
    .map(asset => ({ asset, plan: planWith([asset]) }))
    .filter(({ plan }) => canComplete(plan))
    .sort(
      (a, b) =>
        sameChainRank(a.asset) - sameChainRank(b.asset) ||
        crossLegCount(a.plan) - crossLegCount(b.plan) ||
        (a.asset.isMainstream ? 0 : 1) - (b.asset.isMainstream ? 0 : 1) ||
        mainnetCrossLegCount(a.plan) - mainnetCrossLegCount(b.plan) ||
        b.asset.usdValue - a.asset.usdValue ||
        compareText(tokenKey(a.asset), tokenKey(b.asset)),
    );

  if (best) {
    return [best.asset];
  }

  const plan = planWith(assets);
  return canComplete(plan)
    ? assets.filter(a => (plan.paymentBySource[tokenKey(a)] ?? 0) > 0)
    : [];
};
