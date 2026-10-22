import BigNumber from 'bignumber.js';
import type { TokenItem, Tx } from '@rabby-wallet/rabby-api/dist/types';
import type { BroadcastResult, LegRunner } from './executor';
import { ExecutionStoppedError, type PauseGate } from './pauseGate';
import type { HeadlessDirectSigner } from './signer';
import type { ExecLeg, FailReason, LegKind } from './types';

export type RouteQuote = {
  /** in receive-token units */
  receiveAmount: BigNumber;
  build(): Promise<Tx[] | undefined>;
  onBroadcast?(txHash: string): Promise<void>;
};

export type RouteAdapter = {
  quote(params: {
    payToken: TokenItem;
    receiveToken: TokenItem;
    payAmount: BigNumber;
    slippagePct: number;
  }): Promise<RouteQuote | null>;
};

export type LegRunnerDeps = {
  /** user-selected max price impact in percent: 1 / 5 / 20 */
  maxPriceImpactPct: number;
  routes: Record<LegKind, RouteAdapter>;
  getToken(chainServerId: string, tokenId: string): Promise<TokenItem>;
  isNativeToken(chainServerId: string, tokenId: string): boolean;
  isTwoStepChain(chainServerId: string): boolean;
  /** gas reserved for one tx, in native-token units */
  getNativeGasReserve(chainServerId: string): Promise<BigNumber>;
  getSigner(chainServerId: string): HeadlessDirectSigner;
  classifySignError(error: unknown): FailReason;
  /** true when mined successfully; throws ExecutionStoppedError once cancelled */
  waitForTxCompleted(params: {
    hash: string;
    chainServerId: string;
    isCancelled: () => boolean;
  }): Promise<boolean>;
  waitForBridgeArrival(params: {
    leg: ExecLeg;
    txHash: string;
    isCancelled: () => boolean;
  }): Promise<boolean>;
  refreshAutoLock(): void;
};

const fail = (reason: FailReason): BroadcastResult => ({ ok: false, reason });

const tokenBalance = (token: TokenItem) =>
  new BigNumber(token.raw_amount_hex_str || 0, 16).div(
    new BigNumber(10).pow(token.decimals),
  );

export const createLegRunner = (deps: LegRunnerDeps): LegRunner => {
  const resolvePayAmount = async (leg: ExecLeg, payToken: TokenItem) => {
    const balance = tokenBalance(payToken);
    if (leg.payAll) {
      return balance;
    }
    if (!payToken.price) {
      return new BigNumber(0);
    }
    const wanted = new BigNumber(leg.amountUsd).div(payToken.price);
    const cap = deps.isNativeToken(leg.pay.chain, leg.pay.id)
      ? balance.minus(await deps.getNativeGasReserve(leg.pay.chain))
      : balance;
    return BigNumber.min(wanted, cap).decimalPlaces(
      payToken.decimals,
      BigNumber.ROUND_DOWN,
    );
  };

  const signAndBroadcast = async (
    leg: ExecLeg,
    txs: Tx[],
    gate: PauseGate,
  ): Promise<BroadcastResult> => {
    const chainServerId = leg.pay.chain;
    const signer = deps.getSigner(chainServerId);
    const groups = deps.isTwoStepChain(chainServerId)
      ? txs.map(tx => [tx])
      : [txs];
    let txHash = '';
    try {
      for (let i = 0; i < groups.length; i++) {
        await gate.wait();
        await signer.prefetch(groups[i]);
        await gate.wait();
        const hashes = await signer.openDirect(groups[i]);
        txHash = hashes[hashes.length - 1] || '';
        if (!txHash) {
          return fail('failed');
        }
        if (i < groups.length - 1) {
          const mined = await deps.waitForTxCompleted({
            hash: txHash,
            chainServerId,
            isCancelled: gate.isStopped,
          });
          if (!mined) {
            return fail('failed');
          }
        }
      }
    } catch (error) {
      if (error instanceof ExecutionStoppedError) {
        throw error;
      }
      return fail(deps.classifySignError(error));
    } finally {
      signer.close();
    }
    return { ok: true, txHash };
  };

  return {
    async prepareAndBroadcast(leg, gate) {
      await gate.wait();
      deps.refreshAutoLock();
      const [payToken, receiveToken] = await Promise.all([
        deps.getToken(leg.pay.chain, leg.pay.id),
        deps.getToken(leg.receive.chain, leg.receive.id),
      ]);
      const payAmount = await resolvePayAmount(leg, payToken);
      if (!payAmount.gt(0)) {
        return fail('insufficientBalance');
      }

      await gate.wait();
      const slippagePct = deps.maxPriceImpactPct / 2;
      const quote = await deps.routes[leg.kind].quote({
        payToken,
        receiveToken,
        payAmount,
        slippagePct,
      });
      if (!quote) {
        return fail('noQuote');
      }

      const payUsd = payAmount.times(payToken.price || 0);
      if (payUsd.gt(0) && receiveToken.price) {
        const impactPct = quote.receiveAmount
          .times(receiveToken.price)
          .minus(payUsd)
          .div(payUsd)
          .times(100);
        if (impactPct.lte(-slippagePct)) {
          return fail('priceImpact');
        }
      }

      await gate.wait();
      const txs = await quote.build();
      if (!txs?.length) {
        return fail('failed');
      }

      const result = await signAndBroadcast(leg, txs, gate);
      if (result.ok && quote.onBroadcast) {
        await quote.onBroadcast(result.txHash).catch(() => undefined);
      }
      return result;
    },
    waitForReceipt: (leg, txHash, gate) =>
      deps.waitForTxCompleted({
        hash: txHash,
        chainServerId: leg.pay.chain,
        isCancelled: gate.isStopped,
      }),
    waitForArrival: (leg, txHash, gate) =>
      deps.waitForBridgeArrival({ leg, txHash, isCancelled: gate.isStopped }),
  };
};
