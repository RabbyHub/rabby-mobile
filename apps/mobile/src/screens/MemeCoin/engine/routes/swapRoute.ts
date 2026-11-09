import BigNumber from 'bignumber.js';
import pRetry from 'p-retry';
import type { Tx } from '@rabby-wallet/rabby-api/dist/types';
import { DEX_ENUM, DEX_SPENDER_WHITELIST } from '@rabby-wallet/rabby-swap';
import { DEX } from '@/constant/swap';
import { gasMarketV2, getRecommendNonce } from '@/core/apis/provider';
import { openapi } from '@/core/request';
import type { Account } from '@/core/startupServices/preference';
import { getRabbyFeeRate } from '@/screens/Swap/hooks/fee';
import type { TDexQuoteData } from '@/screens/Swap/hooks/quote';
import { buildDexSwap } from '@/screens/Swap/hooks/swap';
import { getSwapQuoteScore } from '@/screens/Swap/hooks/token';
import { isSwapWrapToken } from '@/screens/Swap/utils';
import { findChainByServerID } from '@/utils/chain';
import type { RouteAdapter } from '../legRunner';
import { fetchDexQuotesIsolated, type GetDexQuote } from './dexQuotes';

export const createSwapRoute = ({
  account,
  getDexQuote,
  supportedDexList,
}: {
  account: Account;
  getDexQuote: GetDexQuote;
  supportedDexList: string[];
}): RouteAdapter => ({
  async quote({ payToken, receiveToken, payAmount, slippagePct }) {
    const chain = findChainByServerID(payToken.chain);
    if (!chain) {
      return null;
    }
    const payAmountText = payAmount.toString(10);
    const isWrapToken = isSwapWrapToken(
      payToken.id,
      receiveToken.id,
      chain.enum,
    );
    const fee = getRabbyFeeRate({
      payToken,
      payAmount: payAmountText,
      payTokenPrice: payToken.price || 0,
      receiveToken,
      isWrapToken,
    });
    const dexIds = isWrapToken
      ? [DEX_ENUM.WRAPTOKEN]
      : Object.keys(DEX).filter(id => supportedDexList.includes(id));

    const quotes = await fetchDexQuotesIsolated({
      dexIds,
      chain,
      args: {
        payToken,
        receiveToken,
        userAddress: account.address,
        slippage: String(slippagePct),
        fee,
        payAmount: payAmountText,
        chain: chain.enum,
        inSufficient: false,
        account,
      },
      deps: {
        getDexQuote,
        getRecommendNonce,
        getGasMarket: chainServerId =>
          gasMarketV2({ chainId: chainServerId }, account),
        getToken: (userAddress, chainServerId, tokenId) =>
          pRetry(() => openapi.getToken(userAddress, chainServerId, tokenId), {
            retries: 1,
          }),
      },
    });

    const best = quotes.reduce<
      { quote: TDexQuoteData; score: BigNumber } | undefined
    >((acc, quote) => {
      const score = getSwapQuoteScore({
        quote,
        receiveToken,
        inSufficient: false,
      });
      return score && (!acc || score.gt(acc.score)) ? { quote, score } : acc;
    }, undefined)?.quote;
    if (!best?.data || !best.preExecResult) {
      return null;
    }

    const quoteResult = best.data;
    const preExec = best.preExecResult;
    const receiveAmount = new BigNumber(quoteResult.toTokenAmount).div(
      new BigNumber(10).pow(
        quoteResult.toTokenDecimals || receiveToken.decimals,
      ),
    );

    return {
      receiveAmount,
      build: async () =>
        (await buildDexSwap(
          {
            swapPreferMEVGuarded: false,
            chain: chain.enum,
            quote: quoteResult,
            needApprove: preExec.shouldApproveToken,
            spender:
              best.name === DEX_ENUM.WRAPTOKEN
                ? ''
                : DEX_SPENDER_WHITELIST[
                    best.name as keyof typeof DEX_SPENDER_WHITELIST
                  ][chain.enum],
            pay_token_id: payToken.id,
            unlimited: false,
            shouldTwoStepApprove: preExec.shouldTwoStepApprove,
            gasPrice: undefined,
            postSwapParams: {
              quote: {
                pay_token_id: payToken.id,
                pay_token_amount: Number(payAmountText),
                receive_token_id: receiveToken.id,
                receive_token_amount: receiveAmount.toNumber(),
                slippage: new BigNumber(slippagePct).div(100).toNumber(),
              },
              dex_id: best.name,
              fee_rate: Number(fee),
            },
            account,
          },
          { ga: { category: 'Swap', source: 'memecoin', trigger: 'memecoin' } },
        )) as Tx[] | undefined,
    };
  },
});
