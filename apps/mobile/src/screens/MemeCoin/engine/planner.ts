import { AMOUNT_EPSILON, ETH_MAINNET_SERVER_ID } from './constants';
import { compareText, legKey, tokenKey } from './keys';
import type {
  ChainServerId,
  GasPayer,
  MemeTarget,
  PaymentAsset,
  PlanInput,
  PlannedLeg,
  PlanResult,
  TokenRef,
} from './types';

type SourceState = {
  asset: PaymentAsset;
  key: string;
  remaining: number;
  gasPayer: GasPayer;
};

type Allocation = {
  source: SourceState;
  meme: MemeTarget;
  amountUsd: number;
};

type SourceOrder = (a: SourceState, b: SourceState) => number;

const toRef = ({ id, chain, symbol }: TokenRef): TokenRef => ({
  id,
  chain,
  symbol,
});

const riskLast = (s: SourceState) => (s.gasPayer === 'risk' ? 1 : 0);
const mainnetLast = (s: SourceState) =>
  s.asset.chain === ETH_MAINNET_SERVER_ID ? 1 : 0;
const mainstreamFirst = (s: SourceState) => (s.asset.isMainstream ? 0 : 1);
const longTailFirst = (s: SourceState) => (s.asset.isMainstream ? 1 : 0);

const sameChainSingle: SourceOrder = (a, b) =>
  riskLast(a) - riskLast(b) ||
  longTailFirst(a) - longTailFirst(b) ||
  a.remaining - b.remaining ||
  compareText(a.key, b.key);

const sameChainSplit: SourceOrder = (a, b) =>
  riskLast(a) - riskLast(b) ||
  b.remaining - a.remaining ||
  compareText(a.key, b.key);

const crossChainSingle: SourceOrder = (a, b) =>
  riskLast(a) - riskLast(b) ||
  mainnetLast(a) - mainnetLast(b) ||
  mainstreamFirst(a) - mainstreamFirst(b) ||
  a.remaining - b.remaining ||
  compareText(a.key, b.key);

const crossChainSplit: SourceOrder = (a, b) =>
  riskLast(a) - riskLast(b) ||
  mainnetLast(a) - mainnetLast(b) ||
  mainstreamFirst(a) - mainstreamFirst(b) ||
  b.remaining - a.remaining ||
  compareText(a.key, b.key);

export const computeMemeTargets = (amountUsd: number, memes: MemeTarget[]) => {
  const totalCap = memes.reduce((sum, m) => sum + Math.max(m.marketCap, 0), 0);
  return memes.map(meme => ({
    meme,
    amountUsd:
      totalCap > 0
        ? (amountUsd * Math.max(meme.marketCap, 0)) / totalCap
        : amountUsd / memes.length,
  }));
};

export const compareLegsForExecution = (a: PlannedLeg, b: PlannedLeg) =>
  b.amountUsd - a.amountUsd ||
  compareText(a.pay.chain, b.pay.chain) ||
  compareText(a.key, b.key);

const resolveSources = (
  input: PlanInput,
  legsPerChain: Record<ChainServerId, number>,
): SourceState[] => {
  let gasAccountBudget = input.gasAccountBalanceUsd;
  const chains = Array.from(new Set(input.sources.map(s => s.chain))).sort(
    compareText,
  );
  const states: SourceState[] = [];

  chains.forEach(chain => {
    const chainSources = input.sources.filter(s => s.chain === chain);
    const gas = input.chainGas[chain];
    const need = (gas?.perLegGasUsd ?? 0) * (legsPerChain[chain] ?? 0);
    const native = chainSources.find(s => s.isNative);

    let gasPayer: GasPayer;
    let nativeSpendable: number | undefined;
    if (native && native.usdValue >= need) {
      gasPayer = 'native';
      nativeSpendable = native.usdValue - need;
    } else {
      if (native) {
        nativeSpendable = 0;
      }
      if (!native && (gas?.nativeBalanceUsd ?? 0) >= need) {
        gasPayer = 'native';
      } else if (gasAccountBudget >= need) {
        gasPayer = 'gasAccount';
        gasAccountBudget -= need;
      } else {
        gasPayer = 'risk';
      }
    }

    chainSources.forEach(asset => {
      states.push({
        asset,
        key: tokenKey(asset),
        remaining:
          asset.isNative && nativeSpendable !== undefined
            ? nativeSpendable
            : asset.usdValue,
        gasPayer,
      });
    });
  });

  return states;
};

const fill = (
  demand: number,
  candidates: SourceState[],
  singleOrder: SourceOrder,
  splitOrder: SourceOrder,
): { source: SourceState; amountUsd: number }[] => {
  const usable = candidates.filter(s => s.remaining > AMOUNT_EPSILON);
  const [single] = usable
    .filter(s => s.remaining >= demand - AMOUNT_EPSILON)
    .sort(singleOrder);
  if (single) {
    const amountUsd = Math.min(demand, single.remaining);
    single.remaining -= amountUsd;
    return [{ source: single, amountUsd }];
  }

  const picks: { source: SourceState; amountUsd: number }[] = [];
  let left = demand;
  [...usable].sort(splitOrder).forEach(source => {
    if (left <= AMOUNT_EPSILON) {
      return;
    }
    const amountUsd = Math.min(left, source.remaining);
    source.remaining -= amountUsd;
    left -= amountUsd;
    picks.push({ source, amountUsd });
  });
  return picks;
};

const allocate = (input: PlanInput, sources: SourceState[]): Allocation[] => {
  const targets = computeMemeTargets(input.amountUsd, input.memes)
    .filter(t => t.amountUsd > AMOUNT_EPSILON)
    .sort(
      (a, b) =>
        b.amountUsd - a.amountUsd ||
        compareText(tokenKey(a.meme), tokenKey(b.meme)),
    );
  const allocations: Allocation[] = [];
  const crossDemands: { meme: MemeTarget; amountUsd: number }[] = [];

  targets.forEach(({ meme, amountUsd }) => {
    const picks = fill(
      amountUsd,
      sources.filter(s => s.asset.chain === meme.chain),
      sameChainSingle,
      sameChainSplit,
    );
    const covered = picks.reduce((sum, p) => sum + p.amountUsd, 0);
    picks.forEach(p => allocations.push({ ...p, meme }));
    if (amountUsd - covered > AMOUNT_EPSILON) {
      crossDemands.push({ meme, amountUsd: amountUsd - covered });
    }
  });

  crossDemands
    .sort((a, b) => b.amountUsd - a.amountUsd)
    .forEach(({ meme, amountUsd }) => {
      fill(
        amountUsd,
        sources.filter(
          s =>
            s.asset.chain !== meme.chain &&
            !!input.chainGas[s.asset.chain]?.bridgeSupported,
        ),
        crossChainSingle,
        crossChainSplit,
      ).forEach(p => allocations.push({ ...p, meme }));
    });

  return allocations;
};

const countLegsPerChain = (allocations: Allocation[]) =>
  allocations.reduce<Record<ChainServerId, number>>((acc, a) => {
    acc[a.source.asset.chain] = (acc[a.source.asset.chain] ?? 0) + 1;
    return acc;
  }, {});

export const planBuy = (input: PlanInput): PlanResult => {
  if (input.amountUsd <= 0 || !input.memes.length) {
    return {
      legs: [],
      paymentBySource: {},
      spendableTotalUsd: 0,
      shortfallUsd: Math.max(input.amountUsd, 0),
    };
  }

  const firstPassLegs: Record<ChainServerId, number> = {};
  input.sources.forEach(s => {
    firstPassLegs[s.chain] = 1;
  });
  const firstPass = allocate(input, resolveSources(input, firstPassLegs));

  const secondPassLegs = { ...firstPassLegs };
  Object.entries(countLegsPerChain(firstPass)).forEach(([chain, count]) => {
    secondPassLegs[chain] = Math.max(count, 1);
  });
  // Pass 2 may still place more legs on a chain than gas was reserved for;
  // execution-time balance capping is the fallback for that case.
  const sources = resolveSources(input, secondPassLegs);
  const spendableTotalUsd = sources.reduce((sum, s) => sum + s.remaining, 0);

  const legs = allocate(input, sources)
    .map(
      ({ source, meme, amountUsd }): PlannedLeg => ({
        key: legKey(source.asset, meme),
        kind: source.asset.chain === meme.chain ? 'swap' : 'bridge',
        pay: toRef(source.asset),
        receive: toRef(meme),
        amountUsd,
        gasPayer: source.gasPayer,
      }),
    )
    .sort(compareLegsForExecution);

  const paymentBySource: Record<string, number> = {};
  legs.forEach(leg => {
    const key = tokenKey(leg.pay);
    paymentBySource[key] = (paymentBySource[key] ?? 0) + leg.amountUsd;
  });

  const allocated = legs.reduce((sum, l) => sum + l.amountUsd, 0);
  const shortfall = input.amountUsd - allocated;

  return {
    legs,
    paymentBySource,
    spendableTotalUsd,
    shortfallUsd: shortfall > AMOUNT_EPSILON ? shortfall : 0,
  };
};
