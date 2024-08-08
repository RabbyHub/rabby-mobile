import { INTERNAL_REQUEST_ORIGIN } from '@/constant';
import { DEX, ETH_USDT_CONTRACT, SWAP_FEE_ADDRESS } from '@/constant/swap';
import {
  generateApproveTokenTx,
  getERC20Allowance,
  getRecommendNonce,
} from '@/core/apis/provider';
import { openapi } from '@/core/request';
import { preferenceService, swapService } from '@/core/services';
import { ChainGas } from '@/core/services/preference';
import { formatUsdValue } from '@/utils/number';
import { stats } from '@/utils/stats';
import { CHAINS, CHAINS_ENUM } from '@debank/common';
import { addressUtils } from '@rabby-wallet/base-utils';
import {
  ExplainTxResponse,
  TokenItem,
  Tx,
} from '@rabby-wallet/rabby-api/dist/types';
import {
  DEX_ENUM,
  DEX_ROUTER_WHITELIST,
  DEX_SPENDER_WHITELIST,
  WrapTokenAddressMap,
} from '@rabby-wallet/rabby-swap';
import {
  DecodeCalldataResult,
  QuoteResult,
  decodeCalldata,
  getQuote,
} from '@rabby-wallet/rabby-swap/dist/quote';
import BigNumber from 'bignumber.js';
import pRetry from 'p-retry';
import React from 'react';
import { useSwapSupportedDexList } from './settings';
import { findChain, findChainByEnum } from '@/utils/chain';
// import { verifySdk } from './verify';

const { isSameAddress } = addressUtils;

export interface validSlippageParams {
  chain: CHAINS_ENUM;
  slippage: string;
  payTokenId: string;
  receiveTokenId: string;
}

export const useQuoteMethods = () => {
  // const walletController = useWallet();
  const walletOpenapi = openapi;
  const validSlippage = React.useCallback(
    async ({
      chain,
      slippage,
      payTokenId,
      receiveTokenId,
    }: validSlippageParams) => {
      const p = {
        slippage: new BigNumber(slippage).div(100).toString(),
        chain_id: findChainByEnum(chain)?.serverId || CHAINS[chain].serverId,
        from_token_id: payTokenId,
        to_token_id: receiveTokenId,
      };

      return walletOpenapi.checkSlippage(p);
    },
    [walletOpenapi],
  );

  const getSwapList = React.useCallback(
    async (addr: string, start = 0, limit = 5) => {
      const data = await walletOpenapi.getSwapTradeList({
        user_addr: addr,
        start: `${start}`,
        limit: `${limit}`,
      });
      return {
        list: data?.history_list,
        last: data,
        totalCount: data?.total_cnt,
      };
    },
    [walletOpenapi],
  );
  const postSwap = React.useCallback(
    async ({
      payToken,
      receiveToken,
      payAmount,
      // receiveRawAmount,
      slippage,
      dexId,
      txId,
      quote,
      tx,
    }: postSwapParams) =>
      walletOpenapi.postSwap({
        quote: {
          pay_token_id: payToken.id,
          pay_token_amount: Number(payAmount),
          receive_token_id: receiveToken.id,
          receive_token_amount: new BigNumber(quote.toTokenAmount)
            .div(10 ** (quote.toTokenDecimals || receiveToken.decimals))
            .toNumber(),
          slippage: new BigNumber(slippage).div(100).toNumber(),
        },
        // 0xAPI => 0x
        dex_id: dexId.replace('API', ''),
        tx_id: txId,
        tx,
      }),
    [walletOpenapi],
  );

  const getToken = React.useCallback(
    async ({ addr, chain, tokenId }: getTokenParams) => {
      return walletOpenapi.getToken(
        addr,
        findChainByEnum(chain)?.serverId || CHAINS[chain].serverId,
        tokenId, // CHAINS[chain].nativeTokenAddress
      );
    },
    [walletOpenapi],
  );

  const getTokenApproveStatus = React.useCallback(
    async ({
      payToken,
      receiveToken,
      payAmount,
      chain,
      dexId,
    }: Pick<
      getDexQuoteParams,
      'payToken' | 'receiveToken' | 'payAmount' | 'chain' | 'dexId'
    >) => {
      const chainInfo = findChainByEnum(chain) || CHAINS[chain];
      if (
        payToken?.id === chainInfo.nativeTokenAddress ||
        isSwapWrapToken(payToken.id, receiveToken.id, chain)
      ) {
        return [true, false];
      }

      const allowance = await getERC20Allowance(
        chainInfo.serverId,
        payToken.id,
        getSpender(dexId, chain),
      );

      const tokenApproved = new BigNumber(allowance).gte(
        new BigNumber(payAmount).times(10 ** payToken.decimals),
      );

      if (
        chain === CHAINS_ENUM.ETH &&
        isSameAddress(payToken.id, ETH_USDT_CONTRACT) &&
        Number(allowance) !== 0 &&
        !tokenApproved
      ) {
        return [tokenApproved, true];
      }
      return [tokenApproved, false];
    },
    [],
  );

  const getPreExecResult = React.useCallback(
    async ({
      userAddress,
      chain,
      payToken,
      receiveToken,
      payAmount,
      dexId,
      quote,
    }: getPreExecResultParams) => {
      const chainInfo = findChainByEnum(chain) || CHAINS[chain];
      const nonce = await getRecommendNonce({
        from: userAddress,
        chainId: chainInfo.id,
      });
      const lastTimeGas: ChainGas | null =
        await preferenceService.getLastTimeGasSelection(chainInfo.id);
      const gasMarket = await walletOpenapi.gasMarket(chainInfo.serverId);

      let gasPrice = 0;
      if (lastTimeGas?.lastTimeSelect === 'gasPrice' && lastTimeGas.gasPrice) {
        // use cached gasPrice if exist
        gasPrice = lastTimeGas.gasPrice;
      } else if (
        lastTimeGas?.lastTimeSelect &&
        lastTimeGas?.lastTimeSelect === 'gasLevel'
      ) {
        const target = gasMarket.find(
          item => item.level === lastTimeGas?.gasLevel,
        )!;
        if (target) {
          gasPrice = target.price;
        } else {
          gasPrice =
            gasMarket.find(item => item.level === 'normal')?.price || 0;
        }
      } else {
        // no cache, use the fast level in gasMarket
        gasPrice = gasMarket.find(item => item.level === 'normal')?.price || 0;
      }

      let nextNonce = nonce;
      const pendingTx: Tx[] = [];
      let gasUsed = 0;

      const approveToken = async (amount: string) => {
        const tokenApproveParams = await generateApproveTokenTx({
          from: userAddress,
          to: payToken.id,
          chainId: chainInfo.id,
          spender: getSpender(dexId, chain),
          amount,
        });
        const tokenApproveTx = {
          ...tokenApproveParams,
          nonce: nextNonce,
          value: '0x',
          gasPrice: `0x${new BigNumber(gasPrice).toString(16)}`,
          gas: '0x0',
        };

        const tokenApprovePreExecTx = await walletOpenapi.preExecTx({
          tx: tokenApproveTx,
          origin: INTERNAL_REQUEST_ORIGIN,
          address: userAddress,
          updateNonce: true,
          pending_tx_list: pendingTx,
        });

        if (!tokenApprovePreExecTx?.pre_exec?.success) {
          throw new Error('pre_exec_tx error');
        }

        gasUsed +=
          tokenApprovePreExecTx.gas.gas_limit ||
          tokenApprovePreExecTx.gas.gas_used;

        pendingTx.push({
          ...tokenApproveTx,
          gas: `0x${new BigNumber(
            tokenApprovePreExecTx.gas.gas_limit ||
              tokenApprovePreExecTx.gas.gas_used,
          )
            .times(4)
            .toString(16)}`,
        });
        nextNonce = `0x${new BigNumber(nextNonce).plus(1).toString(16)}`;
      };

      const [tokenApproved, shouldTwoStepApprove] = await getTokenApproveStatus(
        {
          payToken,
          receiveToken,
          payAmount,
          chain,
          dexId,
        },
      );

      if (shouldTwoStepApprove) {
        await approveToken('0');
      }

      if (!tokenApproved) {
        await approveToken(
          new BigNumber(payAmount).times(10 ** payToken.decimals).toFixed(0, 1),
        );
      }

      const swapPreExecTx = await walletOpenapi.preExecTx({
        tx: {
          ...quote.tx,
          nonce: nextNonce,
          chainId: chainInfo.id,
          value: `0x${new BigNumber(quote.tx.value).toString(16)}`,
          gasPrice: `0x${new BigNumber(gasPrice).toString(16)}`,
          gas: '0x0',
        } as Tx,
        origin: INTERNAL_REQUEST_ORIGIN,
        address: userAddress,
        updateNonce: true,
        pending_tx_list: pendingTx,
      });

      if (!swapPreExecTx?.pre_exec?.success) {
        throw new Error('pre_exec_tx error');
      }

      gasUsed += swapPreExecTx.gas.gas_limit || swapPreExecTx.gas.gas_used;

      const gasUsdValue = new BigNumber(gasUsed)
        .times(gasPrice)
        .div(10 ** swapPreExecTx.native_token.decimals)
        .times(swapPreExecTx.native_token.price)
        .toString(10);

      return {
        shouldApproveToken: !tokenApproved,
        shouldTwoStepApprove,
        swapPreExecTx,
        gasPrice,
        gasUsdValue,
        gasUsd: formatUsdValue(gasUsdValue),
      };
    },
    [walletOpenapi, getTokenApproveStatus],
  );

  const getDexQuote = React.useCallback(
    async ({
      payToken,
      receiveToken,
      userAddress,
      slippage,
      fee: feeAfterDiscount,
      payAmount,
      chain,
      dexId,
      setQuote,
    }: getDexQuoteParams & {
      setQuote?: (quote: TDexQuoteData) => void;
    }): Promise<TDexQuoteData> => {
      const isOpenOcean = dexId === DEX_ENUM.OPENOCEAN;
      const chainInfo = findChainByEnum(chain) || CHAINS[chain];
      try {
        let gasPrice: number;
        if (isOpenOcean) {
          const gasMarket = await walletOpenapi.gasMarket(chainInfo.serverId);
          gasPrice = gasMarket?.[1]?.price;
        }
        stats.report('swapRequestQuote', {
          dex: dexId,
          chain,
          fromToken: payToken.id,
          toToken: receiveToken.id,
        });

        const data = await pRetry(
          () =>
            getQuote(
              isSwapWrapToken(payToken.id, receiveToken.id, chain)
                ? DEX_ENUM.WRAPTOKEN
                : dexId,
              {
                fromToken: payToken.id,
                toToken: receiveToken.id,
                feeAddress: SWAP_FEE_ADDRESS,
                fromTokenDecimals: payToken.decimals,
                amount: new BigNumber(payAmount)
                  .times(10 ** payToken.decimals)
                  .toFixed(0, 1),
                userAddress,
                slippage: Number(slippage),
                feeRate:
                  feeAfterDiscount === '0' && isOpenOcean
                    ? undefined
                    : Number(feeAfterDiscount) || 0,
                chain,
                gasPrice,
                fee: true,
              },
              walletOpenapi,
            ),
          {
            retries: 1,
          },
        );

        stats.report('swapQuoteResult', {
          dex: dexId,
          chain,
          fromToken: payToken.id,
          toToken: receiveToken.id,
          status: data ? 'success' : 'fail',
        });

        let preExecResult;
        if (data) {
          try {
            preExecResult = await pRetry(
              () =>
                getPreExecResult({
                  userAddress,
                  chain,
                  payToken,
                  receiveToken,
                  payAmount,
                  quote: data,
                  dexId: dexId as DEX_ENUM,
                }),
              {
                retries: 1,
              },
            );
            const { isSdkDataPass } = verifySdk({
              chain,
              dexId,
              slippage,
              data: {
                ...data,
                fromToken: payToken.id,
                fromTokenAmount: new BigNumber(payAmount)
                  .times(10 ** payToken.decimals)
                  .toFixed(0, 1),
                toToken: receiveToken?.id,
              },
              payToken,
              receiveToken,
            });
            preExecResult.isSdkPass = isSdkDataPass;
          } catch (error) {
            const quote: TDexQuoteData = {
              data,
              name: dexId,
              isDex: true,
              preExecResult: null,
            };
            setQuote?.(quote);
            return quote;
          }
        }
        const quote: TDexQuoteData = {
          data,
          name: dexId,
          isDex: true,
          preExecResult,
        };
        setQuote?.(quote);
        return quote;
      } catch (error) {
        stats.report('swapQuoteResult', {
          dex: dexId,
          chain,
          fromToken: payToken.id,
          toToken: receiveToken.id,
          status: 'fail',
        });

        const quote: TDexQuoteData = {
          data: null,
          name: dexId,
          isDex: true,
          preExecResult: null,
        };
        setQuote?.(quote);
        return quote;
      }
    },
    [walletOpenapi, getPreExecResult],
  );

  const swapViewList = swapService.getSwapViewList();

  const [supportedDEXList] = useSwapSupportedDexList();

  const getAllQuotes = React.useCallback(
    async (
      params: Omit<getDexQuoteParams, 'dexId'> & {
        setQuote: (quote: TDexQuoteData) => void;
      },
    ) => {
      if (
        isSwapWrapToken(
          params.payToken.id,
          params.receiveToken.id,
          params.chain,
        )
      ) {
        return getDexQuote({
          ...params,
          dexId: DEX_ENUM.WRAPTOKEN,
        });
      }

      return Promise.all([
        ...(
          Object.keys(DEX).filter(
            e => swapViewList?.[e] !== false && supportedDEXList.includes(e),
          ) as DEX_ENUM[]
        ).map(dexId => getDexQuote({ ...params, dexId })),
      ]);
    },
    [getDexQuote, swapViewList, supportedDEXList],
  );

  return {
    validSlippage,
    getSwapList,
    postSwap,
    getToken,
    getTokenApproveStatus,
    getPreExecResult,
    getDexQuote,
    getAllQuotes,
    swapViewList,
  };
};

export interface postSwapParams {
  payToken: TokenItem;
  receiveToken: TokenItem;
  payAmount: string;
  // receiveRawAmount: string;
  slippage: string;
  dexId: string;
  txId: string;
  quote: QuoteResult;
  tx: Tx;
}

interface getTokenParams {
  addr: string;
  chain: CHAINS_ENUM;
  tokenId: string;
}

export const getRouter = (dexId: DEX_ENUM, chain: CHAINS_ENUM) => {
  const list = DEX_ROUTER_WHITELIST[dexId as keyof typeof DEX_ROUTER_WHITELIST];
  return list[chain as keyof typeof list];
};

export const getSpender = (dexId: DEX_ENUM, chain: CHAINS_ENUM) => {
  if (dexId === DEX_ENUM.WRAPTOKEN) {
    return '';
  }
  const list =
    DEX_SPENDER_WHITELIST[dexId as keyof typeof DEX_SPENDER_WHITELIST];
  return list[chain as keyof typeof list];
};

// const INTERNAL_REQUEST_ORIGIN = window.location.origin;

interface getPreExecResultParams
  extends Omit<getDexQuoteParams, 'fee' | 'slippage'> {
  quote: QuoteResult;
}

export const halfBetterRate = (
  full: ExplainTxResponse,
  half: ExplainTxResponse,
) => {
  if (
    full.balance_change.success &&
    half.balance_change.success &&
    half.balance_change.receive_token_list[0]?.amount &&
    full.balance_change.receive_token_list[0]?.amount
  ) {
    const halfReceive = new BigNumber(
      half.balance_change.receive_token_list[0].amount,
    );

    const fullREceive = new BigNumber(
      full.balance_change.receive_token_list[0]?.amount,
    );
    const diff = new BigNumber(halfReceive).times(2).minus(fullREceive);

    return diff.gt(0)
      ? new BigNumber(diff.div(fullREceive).toPrecision(1))
          .times(100)
          .toString(10)
      : null;
  }
  return null;
};

export type QuotePreExecResultInfo = {
  shouldApproveToken: boolean;
  shouldTwoStepApprove: boolean;
  swapPreExecTx: ExplainTxResponse;
  gasPrice: number;
  gasUsd: string;
  gasUsdValue: string;
  isSdkPass?: boolean;
} | null;

interface getDexQuoteParams {
  payToken: TokenItem;
  receiveToken: TokenItem;
  userAddress: string;
  slippage: string;
  fee: string;
  payAmount: string;
  chain: CHAINS_ENUM;
  dexId: DEX_ENUM;
}

export type TDexQuoteData = {
  data: null | QuoteResult;
  name: string;
  isDex: true;
  preExecResult: QuotePreExecResultInfo;
  loading?: boolean;
  isBest?: boolean;
};

export function isSwapWrapToken(
  payTokenId: string,
  receiveId: string,
  chain: CHAINS_ENUM,
) {
  const wrapTokens = [
    WrapTokenAddressMap[chain as keyof typeof WrapTokenAddressMap],
    findChainByEnum(chain)?.nativeTokenAddress ||
      CHAINS[chain].nativeTokenAddress,
  ];
  return (
    !!wrapTokens.find(token => isSameAddress(payTokenId, token)) &&
    !!wrapTokens.find(token => isSameAddress(receiveId, token))
  );
}

export type QuoteProvider = {
  name: string;
  error?: boolean;
  quote: QuoteResult | null;
  manualClick?: boolean;
  preExecResult: QuotePreExecResultInfo;
  shouldApproveToken: boolean;
  shouldTwoStepApprove: boolean;
  halfBetterRate?: string;
  quoteWarning?: [string, string];
  gasPrice?: number;
  activeLoading?: boolean;
  activeTx?: string;
  actualReceiveAmount: string | number;
  gasUsd?: string;
};

// import { findChain } from '@/utils/chain';
// import { CHAINS, CHAINS_ENUM } from '@debank/common';
// import { addressUtils } from '@rabby-wallet/base-utils';
// import { DEX_ENUM } from '@rabby-wallet/rabby-swap';
// import {
//   decodeCalldata,
//   DecodeCalldataResult,
//   QuoteResult,
// } from '@rabby-wallet/rabby-swap/dist/quote';
// import BigNumber from 'bignumber.js';
// import { getRouter, getSpender, isSwapWrapToken } from './quote';

// const { isSameAddress } = addressUtils;

type ValidateTokenParam = {
  id: string;
  symbol: string;
  decimals: number;
};

export const verifyRouterAndSpender = (
  chain: CHAINS_ENUM,
  dexId: DEX_ENUM,
  router?: string,
  spender?: string,
  payTokenId?: string,
  receiveTokenId?: string,
) => {
  if (dexId === DEX_ENUM.WRAPTOKEN) {
    return [true, true];
  }
  if (!dexId || !router || !spender || !payTokenId || !receiveTokenId) {
    return [true, true];
  }
  const routerWhitelist = getRouter(dexId, chain);
  const spenderWhitelist = getSpender(dexId, chain);
  const isNativeToken = isSameAddress(
    payTokenId,
    findChainByEnum(chain)?.nativeTokenAddress ||
      CHAINS[chain].nativeTokenAddress,
  );
  const isWrapTokens = isSwapWrapToken(payTokenId, receiveTokenId, chain);

  return [
    isSameAddress(routerWhitelist, router),
    isNativeToken || isWrapTokens
      ? true
      : isSameAddress(spenderWhitelist, spender),
  ];
};

const isNativeToken = (chain: CHAINS_ENUM, tokenId: string) =>
  isSameAddress(
    tokenId,
    findChainByEnum(chain)?.nativeTokenAddress ||
      CHAINS[chain].nativeTokenAddress,
  );

export const verifyCalldata = <T extends Parameters<typeof decodeCalldata>[1]>(
  data: QuoteResult | null,
  dexId: DEX_ENUM | null,
  slippage: string | number,
  tx?: T,
) => {
  let callDataResult: DecodeCalldataResult | null = null;
  if (dexId && dexId !== DEX_ENUM.WRAPTOKEN && tx) {
    try {
      callDataResult = decodeCalldata(dexId, tx) as DecodeCalldataResult;
    } catch (error) {
      callDataResult = null;
    }
  }

  let result = true;
  if (slippage && callDataResult && data && tx) {
    const estimateMinReceive = new BigNumber(data.toTokenAmount).times(
      new BigNumber(1).minus(slippage),
    );
    const chain = findChain({
      id: tx.chainId,
    });

    if (!chain) {
      result = true;
    } else {
      result =
        ((dexId === DEX_ENUM['UNISWAP'] &&
          isNativeToken(chain.enum, data.fromToken)) ||
          isSameAddress(callDataResult.fromToken, data.fromToken)) &&
        callDataResult.fromTokenAmount === data.fromTokenAmount &&
        isSameAddress(callDataResult.toToken, data.toToken) &&
        new BigNumber(callDataResult.minReceiveToTokenAmount)
          .minus(estimateMinReceive)
          .div(estimateMinReceive)
          .abs()
          .lte(0.05);
    }
  }
  return result;
};

type VerifySdkParams<T extends ValidateTokenParam> = {
  chain: CHAINS_ENUM;
  dexId: DEX_ENUM;
  slippage: string | number;
  data: QuoteResult | null;
  payToken: T;
  receiveToken: T;
};

export const verifySdk = <T extends ValidateTokenParam>(
  p: VerifySdkParams<T>,
) => {
  const { chain, dexId, slippage, data, payToken, receiveToken } = p;

  const isWrapTokens = isSwapWrapToken(payToken.id, receiveToken.id, chain);
  const actualDexId = isWrapTokens ? DEX_ENUM.WRAPTOKEN : dexId;

  const [routerPass, spenderPass] = verifyRouterAndSpender(
    chain,
    actualDexId,
    data?.tx?.to,
    data?.spender,
    payToken?.id,
    receiveToken?.id,
  );

  const callDataPass = verifyCalldata(
    data,
    actualDexId,
    new BigNumber(slippage).div(100).toFixed(),
    data?.tx
      ? { ...data?.tx, chainId: findChainByEnum(chain)?.id || CHAINS[chain].id }
      : undefined,
  );

  return {
    isSdkDataPass: routerPass && spenderPass && callDataPass,
  };
};
