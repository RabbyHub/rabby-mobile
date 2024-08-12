import { CHAINS, CHAINS_ENUM } from '@debank/common';
import {
  CEXQuote,
  ExplainTxResponse,
  TokenItem,
  Tx,
} from '@rabby-wallet/rabby-api/dist/types';
import {
  DEX_ENUM,
  DEX_ROUTER_WHITELIST,
  DEX_SPENDER_WHITELIST,
  getQuote,
  WrapTokenAddressMap,
} from '@rabby-wallet/rabby-swap';
import { QuoteResult } from '@rabby-wallet/rabby-swap/dist/quote';
import BigNumber from 'bignumber.js';
import pRetry from 'p-retry';
import { OpenApiService } from '@rabby-wallet/rabby-api';
import { SWAP_FEE_ADDRESS, DEX, ETH_USDT_CONTRACT, CEX } from '@/constant/swap';
import { addressUtils } from '@rabby-wallet/base-utils';
import { openapi } from '@/core/request';
import {
  getRecommendNonce,
  generateApproveTokenTx,
  getERC20Allowance,
} from '@/core/apis/provider';
import { formatUsdValue } from '@/utils/number';
import { INTERNAL_REQUEST_ORIGIN } from '@/constant';
import { findChainByEnum } from '@/utils/chain';

const { isSameAddress } = addressUtils;

const walletOpenapi = openapi;

export const tokenAmountBn = (token: TokenItem) =>
  new BigNumber(token?.raw_amount_hex_str || 0, 16).div(
    10 ** (token?.decimals || 1),
  );

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

export interface validSlippageParams {
  chain: CHAINS_ENUM;
  slippage: string;
  payTokenId: string;
  receiveTokenId: string;
}
export const validSlippage = async ({
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
};

export const getSwapList = async (addr: string, start = 0, limit = 5) => {
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
export const postSwap = async ({
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
  });

interface getTokenParams {
  addr: string;
  chain: CHAINS_ENUM;
  tokenId: string;
}
export const getToken = async ({ addr, chain, tokenId }: getTokenParams) => {
  return walletOpenapi.getToken(
    addr,
    findChainByEnum(chain)?.serverId || CHAINS[chain].serverId,
    tokenId, // CHAINS[chain].nativeTokenAddress
  );
};

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

const getTokenApproveStatus = async ({
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
};
// const INTERNAL_REQUEST_ORIGIN = window.location.origin;

interface getPreExecResultParams
  extends Omit<getDexQuoteParams, 'fee' | 'slippage'> {
  quote: QuoteResult;
}

export const getPreExecResult = async ({
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

  const gasMarket = await walletOpenapi.gasMarket(chainInfo.serverId);
  const gasPrice = gasMarket?.[1]?.price;

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
    gasUsed += tokenApprovePreExecTx.gas.gas_used;

    pendingTx.push({
      ...tokenApproveTx,
      gas: `0x${new BigNumber(tokenApprovePreExecTx.gas.gas_used)
        .times(4)
        .toString(16)}`,
    });
    nextNonce = `0x${new BigNumber(nextNonce).plus(1).toString(16)}`;
  };

  const [tokenApproved, shouldTwoStepApprove] = await getTokenApproveStatus({
    payToken,
    receiveToken,
    payAmount,
    chain,
    dexId,
  });

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

  gasUsed += swapPreExecTx.gas.gas_used;

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
};

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

// export type QuotePreExecResultInfo = Awaited<
//   ReturnType<typeof getPreExecResult>
// > | null;

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
};
export const getDexQuote = async ({
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
  try {
    let gasPrice: number;
    const isOpenOcean = dexId === DEX_ENUM.OPENOCEAN;

    if (isOpenOcean) {
      const gasMarket = await walletOpenapi.gasMarket(
        findChainByEnum(chain)?.serverId || CHAINS[chain].serverId,
      );
      gasPrice = gasMarket?.[1]?.price;
    }
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
          },
          walletOpenapi as unknown as OpenApiService,
        ),
      {
        retries: 1,
      },
    );
    let preExecResult: TDexQuoteData['preExecResult'] = null;
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
    console.error('getQuote error ', error);

    const quote: TDexQuoteData = {
      data: null,
      name: dexId,
      isDex: true,
      preExecResult: null,
    };
    setQuote?.(quote);
    return quote;
  }
};

export const getAllDexQuotes = async (
  params: Omit<getDexQuoteParams, 'dexId'> & {
    setQuote: (quote: TDexQuoteData) => void;
  },
) => {
  return Promise.all(
    (Object.keys(DEX) as DEX_ENUM[]).map(dexId =>
      getDexQuote({ ...params, dexId }),
    ),
  );
};

interface getAllCexQuotesParams {
  payToken: TokenItem;
  payAmount: string;
  receiveTokenId: string;
  chain: CHAINS_ENUM;
}

export type TCexQuoteData = {
  data: null | CEXQuote;
  name: string;
  isDex: false;
  loading?: boolean;
};
const getCexQuote = async (
  params: getAllCexQuotesParams & {
    cexId: string;
    setQuote?: (quote: TCexQuoteData) => void;
  },
): Promise<TCexQuoteData> => {
  const {
    payToken,
    payAmount,
    receiveTokenId: receive_token_id,
    chain,
    cexId: cex_id,
    setQuote,
  } = params;

  const p = {
    cex_id,
    pay_token_amount: payAmount,
    chain_id: findChainByEnum(chain)?.serverId || CHAINS[chain].serverId,
    pay_token_id: payToken.id,
    receive_token_id,
  };

  let quote: TCexQuoteData;

  try {
    const data = await walletOpenapi.getCEXSwapQuote(p);
    quote = {
      data,
      name: cex_id,
      isDex: false,
    };
  } catch (error) {
    quote = {
      data: null,
      name: cex_id,
      isDex: false,
    };
  }

  setQuote?.(quote);

  return quote;
};

export const getAllQuotes = async (
  params: Omit<getDexQuoteParams, 'dexId'> & {
    setQuote: (quote: TCexQuoteData | TDexQuoteData) => void;
    swapViewList?: Record<keyof typeof DEX | keyof typeof CEX, boolean>;
  },
) => {
  if (
    isSwapWrapToken(params.payToken.id, params.receiveToken.id, params.chain)
  ) {
    return getDexQuote({
      ...params,
      dexId: DEX_ENUM.WRAPTOKEN,
    });
  }

  const { swapViewList } = params;

  return Promise.all([
    ...(Object.keys(DEX) as Exclude<DEX_ENUM, DEX_ENUM.WRAPTOKEN>[])
      .filter(e => swapViewList?.[e] !== false)
      .map(dexId => getDexQuote({ ...params, dexId })),
    ...(Object.keys(CEX) as (keyof typeof CEX)[])
      .filter(e => swapViewList?.[e] !== false)
      .map(cexId =>
        getCexQuote({
          cexId,
          payToken: params.payToken,
          payAmount: params.payAmount,
          receiveTokenId: params.receiveToken.id,
          chain: params.chain,
          setQuote: params.setQuote,
        }),
      ),
  ]);
};
