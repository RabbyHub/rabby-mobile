import BigNumber from 'bignumber.js';
import type { BridgeAggregator } from '@rabby-wallet/rabby-api/dist/types';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import {
  buildTx as buildBridgeTx,
  getQuoteList as getBridgeQuoteList,
} from '@rabby-wallet/rabby-bridge';
import { openapi } from '@/core/request';
import { transactionHistoryServiceApi } from '@/core/serviceApi/transactionHistory';
import type { Account } from '@/core/startupServices/preference';
import { buildBridgeToken } from '@/screens/Bridge/hooks/bridge';
import type { SelectedBridgeQuote } from '@/screens/Bridge/types';
import { getBridgeQuoteApproval } from '@/screens/Bridge/utils/bridgeApproval';
import { resolveBridgeArrival } from '@/screens/Bridge/utils/bridgeArrival';
import { getBestBridgeQuote } from '@/screens/Bridge/utils/bridgeQuote';
import { getRabbyFeeInfo } from '@/screens/Swap/hooks/fee';
import { findChainByServerID } from '@/utils/chain';
import { BRIDGE_ARRIVAL_POLL_INTERVAL_MS } from '../constants';
import type { LegRunnerDeps, RouteAdapter } from '../legRunner';
import { ExecutionStoppedError } from '../pauseGate';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const createBridgeRoute = ({ account }: { account: Account }) => {
  let aggregatorsTask: Promise<BridgeAggregator[]> | undefined;
  const getAggregators = () => {
    if (!aggregatorsTask) {
      aggregatorsTask = openapi.getBridgeAggregatorList().catch(error => {
        aggregatorsTask = undefined;
        throw error;
      });
    }
    return aggregatorsTask;
  };
  const submittedAt = new Map<string, number>();

  const route: RouteAdapter = {
    async quote({ payToken, receiveToken, payAmount, slippagePct }) {
      const aggregators = await getAggregators().catch(() => []);
      const payAmountText = payAmount.toString(10);
      const rawAmount = payAmount
        .times(new BigNumber(10).pow(payToken.decimals))
        .toFixed(0, 1);
      const slippage = new BigNumber(slippagePct).div(100).toString(10);
      const { feeRate } = getRabbyFeeInfo({
        payToken,
        payAmount: payAmountText,
        payTokenPrice: payToken.price || 0,
        type: 'bridge',
        receiveToken,
        isWrapToken: false,
      });

      const settled = await Promise.allSettled(
        aggregators.map(aggregator =>
          getBridgeQuoteList(
            aggregator.id,
            {
              userAddress: account.address,
              fromChainId: payToken.chain,
              fromTokenId: payToken.id,
              fromTokenRawAmount: rawAmount,
              toChainId: receiveToken.chain,
              toTokenId: receiveToken.id,
              slippage,
              feeRate: Number(feeRate),
            },
            openapi,
          ),
        ),
      );
      const quotes = settled
        .flatMap(r => (r.status === 'fulfilled' && r.value ? r.value : []))
        .filter(q => !!q?.bridge?.id && !!q.bridge.logo_url && !!q.bridge.name);
      if (!quotes.length) {
        return null;
      }

      const allowanceCache = new Map<string, Promise<string>>();
      const approvals = await Promise.allSettled(
        quotes.map(async quote => ({
          ...quote,
          loading: false,
          ...(await getBridgeQuoteApproval({
            fromToken: payToken,
            approveContractId: quote.approve_contract_id,
            amount: payAmountText,
            account,
            allowanceCache,
          })),
        })),
      );
      const withApproval: SelectedBridgeQuote[] = approvals.flatMap(r =>
        r.status === 'fulfilled' ? [r.value] : [],
      );
      const best = getBestBridgeQuote(withApproval, receiveToken)?.quote;
      if (!best) {
        return null;
      }

      return {
        receiveAmount: new BigNumber(best.to_token_amount),
        build: async () => {
          const tx = await buildBridgeTx(
            best.aggregator.id,
            {
              bridgeId: best.bridge_id,
              userAddress: account.address,
              fromChainId: payToken.chain,
              fromTokenId: payToken.id,
              fromTokenRawAmount: rawAmount,
              toChainId: receiveToken.chain,
              toTokenId: receiveToken.id,
              slippage,
              quoteKey: best.quote_key || {},
            },
            openapi,
          );
          return buildBridgeToken(
            {
              approveId: best.approve_contract_id,
              to: tx.to,
              value: tx.value,
              data: tx.data,
              payTokenRawAmount: rawAmount,
              chainId: tx.chainId,
              shouldApprove: !!best.shouldApproveToken,
              shouldTwoStepApprove: !!best.shouldTwoStepApprove,
              gasPrice: undefined,
              payTokenId: payToken.id,
              payTokenChainServerId: payToken.chain,
              info: {
                aggregator_id: best.aggregator.id,
                bridge_id: best.bridge_id,
                from_chain_id: payToken.chain,
                from_token_id: payToken.id,
                from_token_amount: payAmountText,
                to_chain_id: receiveToken.chain,
                to_token_id: receiveToken.id,
                to_token_amount: best.to_token_amount,
                tx,
                rabby_fee: best.rabby_fee.usd_value,
                fee_rate: Number(feeRate),
                slippage: new BigNumber(slippagePct).div(100).toNumber(),
                duration: best.duration,
              },
              account,
            },
            {
              ga: {
                category: 'Bridge',
                source: 'memecoin',
                trigger: 'memecoin',
              },
            },
          );
        },
        onBroadcast: async txHash => {
          const createdAt = Date.now();
          submittedAt.set(txHash, createdAt);
          await transactionHistoryServiceApi.addBridgeTxHistory({
            address: account.address,
            fromChainId: findChainByServerID(payToken.chain)?.id || 0,
            toChainId: findChainByServerID(receiveToken.chain)?.id || 0,
            fromToken: payToken,
            toToken: receiveToken,
            slippage: new BigNumber(slippagePct).div(100).toNumber(),
            fromAmount: Number(payAmountText),
            dexId: best.aggregator.id,
            toAmount: Number(best.to_token_amount || 0),
            status: 'pending',
            hash: txHash,
            createdAt,
            estimatedDuration: best.duration || 0,
          });
        },
      };
    },
  };

  const waitForArrival: LegRunnerDeps['waitForBridgeArrival'] = async ({
    leg,
    txHash,
    isCancelled,
  }) => {
    const createdAt = submittedAt.get(txHash) ?? Date.now();
    const fromChainId = findChainByServerID(leg.pay.chain)?.id || 0;
    for (;;) {
      if (isCancelled()) {
        throw new ExecutionStoppedError();
      }
      const res = await openapi
        .getBridgeHistoryList({
          user_addr: account.address,
          start: 0,
          limit: Math.max(10, submittedAt.size + 10),
          is_all: true,
        })
        .catch(() => null);
      if (!res) {
        await sleep(BRIDGE_ARRIVAL_POLL_INTERVAL_MS);
        continue;
      }
      const resolution = resolveBridgeArrival(res.history_list || [], {
        hash: txHash,
        createdAt,
        now: Date.now(),
      });
      if (resolution.type === 'notFoundTimeout') {
        await transactionHistoryServiceApi
          .completeBridgeTxHistory(txHash, fromChainId, 'failed')
          .catch(() => undefined);
        return false;
      }
      if (resolution.type === 'settled') {
        await transactionHistoryServiceApi
          .completeBridgeTxHistory(
            txHash,
            fromChainId,
            resolution.status,
            resolution.bridgeTx,
          )
          .catch(() => undefined);
        return (
          resolution.status === 'allSuccess' &&
          isSameAddress(
            resolution.bridgeTx.to_actual_token?.id || '',
            leg.receive.id,
          )
        );
      }
      await sleep(BRIDGE_ARRIVAL_POLL_INTERVAL_MS);
    }
  };

  return { route, waitForArrival };
};
