import BigNumber from 'bignumber.js';
import type { BridgeAggregator } from '@rabby-wallet/rabby-api/dist/types';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import {
  buildTx as buildBridgeTx,
  getQuoteList as getBridgeQuoteList,
  isSupportedBridgeAggregator,
  isSupportedBridgeChain,
} from '@rabby-wallet/rabby-bridge';
import { openapi } from '@/core/request';
import { transactionHistoryServiceApi } from '@/core/serviceApi/transactionHistory';
import type { BridgeTxHistoryItem } from '@/core/services/transactionHistory';
import type { Account } from '@/core/startupServices/preference';
import { buildBridgeToken } from '@/screens/Bridge/hooks/bridge';
import type { SelectedBridgeQuote } from '@/screens/Bridge/types';
import { getBridgeQuoteApproval } from '@/screens/Bridge/utils/bridgeApproval';
import { resolveBridgeArrival } from '@/screens/Bridge/utils/bridgeArrival';
import { getBestBridgeQuote } from '@/screens/Bridge/utils/bridgeQuote';
import { getRabbyFeeInfo } from '@/screens/Swap/hooks/fee';
import {
  peekBridgeHistory,
  subscribeBridgeHistory,
} from '@/screens/Transaction/bridgeHistoryLookup';
import {
  historyTxKey,
  shouldPollPendingBridge,
} from '@/screens/Transaction/utils/bridgeHistory';
import { findChainByServerID } from '@/utils/chain';
import { BRIDGE_ARRIVAL_POLL_INTERVAL_MS, QUOTE_RATE } from '../constants';
import type { LegRunnerDeps, RouteAdapter } from '../legRunner';
import { ExecutionStoppedError } from '../pauseGate';
import { createRateLimiter } from '../quoteRateLimit';

// Module level: legs on different chains, and every run, share the backend limit.
const quoteLimiter = createRateLimiter(QUOTE_RATE);

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
  const submitted = new Map<string, BridgeTxHistoryItem>();

  const route: RouteAdapter = {
    async quote({ payToken, receiveToken, payAmount, slippagePct }) {
      // getQuoteList rejects these without a request; keep them off the budget
      const aggregators = (await getAggregators().catch(() => [])).filter(
        ({ id }) =>
          isSupportedBridgeAggregator(id) &&
          isSupportedBridgeChain(id, payToken.chain),
      );
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
          quoteLimiter.schedule(() =>
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
          const local: BridgeTxHistoryItem = {
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
            createdAt: Date.now(),
            estimatedDuration: best.duration || 0,
          };
          submitted.set(txHash, local);
          await transactionHistoryServiceApi.addBridgeTxHistory(local);
        },
      };
    },
  };

  const waitForArrival: LegRunnerDeps['waitForBridgeArrival'] = ({
    leg,
    txHash,
    isCancelled,
  }) => {
    const local = submitted.get(txHash);
    // only hashes this route broadcast are waited on
    if (!local) {
      return Promise.resolve(false);
    }
    const query = { chain: local.fromToken.chain, hash: txHash };
    const key = historyTxKey(query.chain, query.hash);

    return new Promise<boolean>((resolve, reject) => {
      let finished = false;
      // The same lookup as the Bridge and history pages: every watched tx in the
      // app shares one batched, paced request.
      const subscription = subscribeBridgeHistory(() => check(), []);
      const timer = setInterval(() => {
        check();
        if (finished) {
          return;
        }
        // the lookup re-polls only records it has found and still treats as fresh
        const found = peekBridgeHistory(query);
        if (!found || !shouldPollPendingBridge(found)) {
          subscription.refresh();
        }
      }, BRIDGE_ARRIVAL_POLL_INTERVAL_MS);

      const finish = (settle: () => void) => {
        finished = true;
        clearInterval(timer);
        subscription.dispose();
        settle();
      };

      const check = () => {
        if (finished) {
          return;
        }
        if (isCancelled()) {
          finish(() => reject(new ExecutionStoppedError()));
          return;
        }
        const history = peekBridgeHistory(query);
        // as on the Bridge page, only an answered lookup can time the tx out
        if (history === undefined) {
          return;
        }
        const resolution = resolveBridgeArrival(
          history ? [history] : [],
          local,
        );
        if (resolution.type === 'notFoundTimeout') {
          finish(() =>
            transactionHistoryServiceApi
              .completeBridgeTxHistory(local.hash, local.fromChainId, 'failed')
              .catch(() => undefined)
              .then(() => resolve(false)),
          );
          return;
        }
        if (resolution.type === 'settled') {
          finish(() =>
            transactionHistoryServiceApi
              .completeBridgeTxHistory(
                local.hash,
                local.fromChainId,
                resolution.status,
                resolution.bridgeTx,
              )
              .catch(() => undefined)
              .then(() =>
                resolve(
                  resolution.status === 'allSuccess' &&
                    isSameAddress(
                      resolution.bridgeTx.to_actual_token?.id || '',
                      leg.receive.id,
                    ),
                ),
              ),
          );
        }
      };

      subscription.update({
        queries: [query],
        transactionKeys: new Set([key]),
        pollableKeys: new Set([key]),
      });
    });
  };

  return { route, waitForArrival };
};
