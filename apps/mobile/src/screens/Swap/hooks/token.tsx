import { CHAINS, CHAINS_ENUM } from '@debank/common';
import { GasLevel, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { WrapTokenAddressMap } from '@rabby-wallet/rabby-swap';
import BigNumber from 'bignumber.js';
import { useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { refreshIdAtom, useQuoteVisible, useSetQuoteVisible } from './atom';
import useAsync from 'react-use/lib/useAsync';
import { openapi } from '@/core/request';
import useDebounce from 'react-use/lib/useDebounce';
import { swapService } from '@/core/services';
import { useAsyncInitializeChainList } from '@/hooks/useChain';
import { SWAP_SUPPORT_CHAINS } from '@/constant/swap';
import { addressUtils } from '@rabby-wallet/base-utils';
import { TCexQuoteData, TDexQuoteData } from '../utils';
import { useSwapSettings } from './settings';
import { QuoteProvider, useQuoteMethods } from './quote';
import { stats } from '@/utils/stats';
import { formatSpeicalAmount } from '@/utils/number';
import { getTokenSymbol } from '@/utils/token';
import { useDebounceFn, useRequest } from 'ahooks';
import { GasLevelType } from '@/components/ReserveGasPopup';
import { findChain, findChainByEnum } from '@/utils/chain';
import { useSlippageStore } from './slippage';

const { isSameAddress } = addressUtils;

const useTokenInfo = ({
  userAddress,
  chain,
  defaultToken,
}: {
  userAddress?: string;
  chain?: CHAINS_ENUM;
  defaultToken?: TokenItem;
}) => {
  const refreshId = useAtomValue(refreshIdAtom);
  const [token, setToken] = useState<TokenItem | undefined>(defaultToken);

  const { value, loading, error } = useAsync(async () => {
    if (userAddress && token?.id && chain) {
      const data = await openapi.getToken(
        userAddress,
        findChainByEnum(chain)?.serverId || CHAINS[chain].serverId,
        token.id,
      );
      return data;
    }
  }, [refreshId, userAddress, token?.id, token?.raw_amount_hex_str, chain]);

  useDebounce(
    () => {
      if (value && !error && !loading) {
        setToken(value);
      }
    },
    300,
    [value, error, loading],
  );

  if (error) {
    console.error('token info error', chain, token?.symbol, token?.id, error);
  }
  return [token, setToken] as const;
};

export const useSlippage = () => {
  const { slippage: slippageState, setSlippage } = useSlippageStore();
  const slippage = useMemo(() => slippageState || '0.1', [slippageState]);
  const [slippageChanged, setSlippageChanged] = useState(false);

  const [isSlippageLow, isSlippageHigh] = useMemo(() => {
    return [
      slippageState?.trim() !== '' && Number(slippageState || 0) < 0.1,
      slippageState?.trim() !== '' && Number(slippageState || 0) > 10,
    ];
  }, [slippageState]);

  return {
    slippageChanged,
    setSlippageChanged,
    slippageState,
    slippage,
    setSlippage,
    isSlippageLow,
    isSlippageHigh,
  };
};

export interface FeeProps {
  fee: '0.25' | '0';
  symbol?: string;
}

export const useTokenPair = (userAddress: string) => {
  // const dispatch = useRabbyDispatch();
  const refreshId = useAtomValue(refreshIdAtom);
  const setRefreshId = useSetAtom(refreshIdAtom);

  const {
    initialSelectedChain,
    oChain,
    defaultSelectedFromToken,
    defaultSelectedToToken,
  } = useMemo(() => {
    const lastSelectedChain = swapService.getSelectedChain();
    return {
      initialSelectedChain: lastSelectedChain, // state.swap.$$initialSelectedChain,
      oChain: lastSelectedChain || CHAINS_ENUM.ETH,
      defaultSelectedFromToken: swapService.getSelectedFromToken(),
      defaultSelectedToToken: swapService.getSelectedToToken(),
    };
  }, []);

  const [chain, setChain] = useState(oChain);
  const handleChain = (c: CHAINS_ENUM) => {
    setChain(c);
    // dispatch.swap.setSelectedChain(c);
    swapService.setSelectedChain(c);
    // resetSwapTokens(c);
  };

  const chainInfo = useMemo(
    () => findChainByEnum(chain) || CHAINS[chain],
    [chain],
  );

  const [payAmount, setPayAmount] = useState('');

  const [feeRate] = useState<FeeProps['fee']>('0');

  const { autoSlippage } = useSlippageStore();

  const {
    slippageChanged,
    setSlippageChanged,
    slippageState,
    slippage,
    setSlippage,
    isSlippageHigh,
    isSlippageLow,
  } = useSlippage();

  const [currentProvider, setOriActiveProvider] = useState<
    QuoteProvider | undefined
  >();

  const expiredTimer = useRef<NodeJS.Timeout>();
  const [expired, setExpired] = useState(false);

  const setActiveProvider: React.Dispatch<
    React.SetStateAction<QuoteProvider | undefined>
  > = useCallback(
    p => {
      if (expiredTimer.current) {
        clearTimeout(expiredTimer.current);
      }
      setSlippageChanged(false);
      setExpired(false);
      expiredTimer.current = setTimeout(() => {
        setExpired(true);
      }, 1000 * 30);
      setOriActiveProvider(p);
    },
    [setSlippageChanged],
  );

  const [payToken, setPayToken] = useTokenInfo({
    userAddress,
    chain,
    defaultToken: defaultSelectedFromToken || getChainDefaultToken(chain),
  });
  const [receiveToken, setReceiveToken] = useTokenInfo({
    userAddress,
    chain,
    defaultToken: defaultSelectedToToken,
  });

  const [bestQuoteDex, setBestQuoteDex] = useState<string>('');

  const switchChain = useCallback(
    (c: CHAINS_ENUM, opts?: { payTokenId?: string; changeTo?: boolean }) => {
      handleChain(c);
      if (!opts?.changeTo) {
        setPayToken({
          ...getChainDefaultToken(c),
          ...(opts?.payTokenId ? { id: opts?.payTokenId } : {}),
        });
        setReceiveToken(undefined);
      } else {
        setReceiveToken({
          ...getChainDefaultToken(c),
          ...(opts?.payTokenId ? { id: opts?.payTokenId } : {}),
        });
        // setPayToken(undefined);
      }
      setPayAmount('');
      setActiveProvider(undefined);
    },
    [setActiveProvider, setPayToken, setReceiveToken],
  );

  useAsyncInitializeChainList({
    // NOTICE: now `useTokenPair` is only used for swap page, so we can use `SWAP_SUPPORT_CHAINS` here
    supportChains: SWAP_SUPPORT_CHAINS,
    onChainInitializedAsync: firstEnum => {
      // only init chain if it's not cached before
      if (!initialSelectedChain) {
        switchChain(firstEnum);
      }
    },
  });

  useEffect(() => {
    // dispatch.swap.setSelectedFromToken(payToken);
    swapService.setSelectedFromToken(payToken);
  }, [payToken]);

  useEffect(() => {
    swapService.setSelectedToToken(receiveToken);
    // dispatch.swap.setSelectedToToken(receiveToken);
  }, [receiveToken]);

  const exchangeToken = useCallback(() => {
    setPayToken(receiveToken);
    setReceiveToken(payToken);
  }, [setPayToken, receiveToken, setReceiveToken, payToken]);

  const payTokenIsNativeToken = useMemo(() => {
    if (payToken) {
      return isSameAddress(payToken.id, chainInfo.nativeTokenAddress);
    }
    return false;
  }, [chainInfo?.nativeTokenAddress, payToken]);

  const handleAmountChange = useCallback((e: string) => {
    const v = formatSpeicalAmount(e);
    if (!/^\d*(\.\d*)?$/.test(v)) {
      return;
    }
    setPayAmount(v);
    setQuoteLoading(true);
  }, []);

  const [gasLevel, setGasLevel] = useState<GasLevelType>('normal');
  const gasPriceRef = useRef<number>();

  const { value: gasList } = useAsync(() => {
    gasPriceRef.current = undefined;
    setGasLevel('normal');
    return openapi.gasMarket(chainInfo.serverId);
  }, [chainInfo?.serverId]);

  const [reserveGasOpen, setReserveGasOpen] = useState(false);

  const normalGasPrice = useMemo(
    () => gasList?.find(e => e.level === 'normal')?.price,
    [gasList],
  );

  const nativeTokenDecimals = useMemo(
    () => findChain({ enum: chain })?.nativeTokenDecimals || 1e18,
    [chain],
  );

  const gasLimit = useMemo(
    () => (chain === CHAINS_ENUM.ETH ? 1000000 : 2000000),
    [chain],
  );

  useEffect(() => {
    if (payTokenIsNativeToken && gasList) {
      const checkGasIsEnough = (price: number) => {
        return new BigNumber(payToken?.raw_amount_hex_str || 0, 16).gte(
          new BigNumber(gasLimit).times(price),
        );
      };
      const normalPrice = gasList?.find(e => e.level === 'normal')?.price || 0;
      const slowPrice = gasList?.find(e => e.level === 'slow')?.price || 0;
      const isNormalEnough = checkGasIsEnough(normalPrice);
      const isSlowEnough = checkGasIsEnough(slowPrice);
      if (isNormalEnough) {
        setGasLevel('normal');
        gasPriceRef.current = normalGasPrice;
      } else if (isSlowEnough) {
        setGasLevel('slow');
        gasPriceRef.current = slowPrice;
      } else {
        setGasLevel('custom');
        gasPriceRef.current = 0;
      }
    }
  }, [
    payTokenIsNativeToken,
    gasList,
    gasLimit,
    payToken?.raw_amount_hex_str,
    normalGasPrice,
  ]);

  const closeReserveGasOpen = useCallback(() => {
    setReserveGasOpen(false);
    if (payToken && gasPriceRef.current !== undefined) {
      const val = tokenAmountBn(payToken).minus(
        new BigNumber(gasLimit)
          .times(gasPriceRef.current)
          .div(10 ** nativeTokenDecimals),
      );
      setPayAmount(val.lt(0) ? '0' : val.toString(10));
    }
  }, [payToken, nativeTokenDecimals, gasLimit]);

  const changeGasPrice = useCallback(
    (gasLevel: GasLevel) => {
      gasPriceRef.current = gasLevel.level === 'custom' ? 0 : gasLevel.price;
      setGasLevel(gasLevel.level as GasLevelType);
      closeReserveGasOpen();
    },
    [closeReserveGasOpen],
  );

  const handleBalance = useCallback(() => {
    if (payTokenIsNativeToken) {
      setReserveGasOpen(true);
      return;
    }
    if (!payTokenIsNativeToken && payToken) {
      setPayAmount(tokenAmountBn(payToken).toString(10));
    }
  }, [payToken, payTokenIsNativeToken]);

  const isStableCoin = useMemo(() => {
    if (payToken?.price && receiveToken?.price) {
      return new BigNumber(payToken?.price)
        .minus(receiveToken?.price)
        .div(payToken?.price)
        .abs()
        .lte(0.01);
    }
    return false;
  }, [payToken, receiveToken]);

  const [isWrapToken, wrapTokenSymbol] = useMemo(() => {
    if (payToken?.id && receiveToken?.id) {
      const wrapTokens = [
        WrapTokenAddressMap[chain],
        chainInfo.nativeTokenAddress,
      ];
      const res =
        !!wrapTokens.find(token => isSameAddress(payToken?.id, token)) &&
        !!wrapTokens.find(token => isSameAddress(receiveToken?.id, token));
      return [
        res,
        isSameAddress(payToken?.id, WrapTokenAddressMap[chain])
          ? getTokenSymbol(payToken)
          : getTokenSymbol(receiveToken),
      ];
    }
    return [false, ''];
  }, [payToken, receiveToken, chain, chainInfo.nativeTokenAddress]);

  const inSufficient = useMemo(
    () =>
      payToken
        ? tokenAmountBn(payToken).lt(payAmount)
        : new BigNumber(0).lt(payAmount),
    [payToken, payAmount],
  );

  useEffect(() => {
    if (autoSlippage) {
      setSlippage(isStableCoin ? '0.1' : '0.5');
    }
  }, [autoSlippage, isStableCoin, setSlippage]);

  const [quoteList, setQuotesList] = useState<TDexQuoteData[]>([]);
  const [visible, settingVisible] = useQuoteVisible();

  useEffect(() => {
    setQuotesList([]);
    setActiveProvider(undefined);
  }, [
    payToken?.id,
    receiveToken?.id,
    chain,
    payAmount,
    inSufficient,
    setActiveProvider,
  ]);

  const setQuote = useCallback(
    (id: number) => (quote: TDexQuoteData) => {
      if (id === fetchIdRef.current) {
        setQuotesList(e => {
          const index = e.findIndex(q => q.name === quote.name);
          // setActiveProvider((activeQuote) => {
          //   if (activeQuote?.name === quote.name) {
          //     return undefined;
          //   }
          //   return activeQuote;
          // });

          const v: TDexQuoteData = { ...quote, loading: false };
          if (index === -1) {
            return [...e, v];
          }
          e[index] = v;
          return [...e];
        });
      }
    },
    [],
  );

  const fetchIdRef = useRef(0);
  const { getAllQuotes, validSlippage } = useQuoteMethods();

  const [quoteLoading, setQuoteLoading] = useState(false);

  const { error: quotesError, runAsync: _runGetAllQuotes } = useRequest(
    async () => {
      fetchIdRef.current += 1;
      const currentFetchId = fetchIdRef.current;
      if (
        userAddress &&
        payToken?.id &&
        receiveToken?.id &&
        receiveToken &&
        chain &&
        Number(payAmount) > 0 &&
        feeRate &&
        !inSufficient
      ) {
        setQuotesList(e =>
          e.map(q => ({ ...q, loading: true, isBest: false })),
        );
        return getAllQuotes({
          userAddress,
          payToken,
          receiveToken,
          slippage: slippage || '0.1',
          chain,
          payAmount: payAmount,
          fee: feeRate,
          setQuote: setQuote(currentFetchId),
        }).finally(() => {
          // enableSwapBySlippageChanged(currentFetchId);
        });
      }
    },
    {
      manual: true,
      onFinally() {
        setQuoteLoading(false);
      },
    },
  );

  const { run: runGetAllQuotes } = useDebounceFn(_runGetAllQuotes, {
    wait: 300,
  });
  useEffect(() => {
    if (
      userAddress &&
      payToken?.id &&
      receiveToken?.id &&
      receiveToken &&
      chain &&
      Number(payAmount) > 0 &&
      feeRate &&
      !inSufficient
    ) {
      setQuoteLoading(true);
      setActiveProvider(undefined);
    }
    runGetAllQuotes();
  }, [
    setActiveProvider,
    inSufficient,
    setQuotesList,
    setQuote,
    refreshId,
    userAddress,
    payToken?.id,
    receiveToken?.id,
    chain,
    payAmount,
    feeRate,
    runGetAllQuotes,
    receiveToken,
  ]);

  useEffect(() => {
    if (
      !quoteLoading &&
      receiveToken &&
      quoteList.every((q, idx) => !q.loading)
    ) {
      const sortIncludeGasFee = true;
      const sortedList = [
        ...(quoteList?.sort((a, b) => {
          const getNumber = (quote: typeof a) => {
            const price = receiveToken.price ? receiveToken.price : 1;
            if (inSufficient) {
              return new BigNumber(quote.data?.toTokenAmount || 0)
                .div(
                  10 ** (quote.data?.toTokenDecimals || receiveToken.decimals),
                )
                .times(price);
            }
            if (!quote.preExecResult || !quote.preExecResult.isSdkPass) {
              return new BigNumber(Number.MIN_SAFE_INTEGER);
            }

            if (sortIncludeGasFee) {
              return new BigNumber(
                quote?.preExecResult.swapPreExecTx.balance_change
                  .receive_token_list?.[0]?.amount || 0,
              )
                .times(price)
                .minus(quote?.preExecResult?.gasUsdValue || 0);
            }

            return new BigNumber(
              quote?.preExecResult.swapPreExecTx.balance_change
                .receive_token_list?.[0]?.amount || 0,
            ).times(price);
          };
          return getNumber(b).minus(getNumber(a)).toNumber();
        }) || []),
      ];

      if (sortedList?.[0]) {
        const bestQuote = sortedList[0];
        const { preExecResult } = bestQuote;

        setBestQuoteDex(bestQuote.name);

        setActiveProvider(preItem =>
          !bestQuote.preExecResult || !bestQuote.preExecResult.isSdkPass
            ? undefined
            : preItem?.manualClick
            ? preItem
            : {
                name: bestQuote.name,
                quote: bestQuote.data,
                preExecResult: bestQuote.preExecResult,
                gasPrice: preExecResult?.gasPrice,
                shouldApproveToken: !!preExecResult?.shouldApproveToken,
                shouldTwoStepApprove: !!preExecResult?.shouldTwoStepApprove,
                error: !preExecResult,
                halfBetterRate: '',
                quoteWarning: undefined,
                actualReceiveAmount:
                  preExecResult?.swapPreExecTx.balance_change
                    .receive_token_list[0]?.amount || '',
                gasUsd: preExecResult?.gasUsd,
              },
        );
      }
    }
  }, [
    quoteList,
    quoteLoading,
    receiveToken,
    inSufficient,
    visible,
    setActiveProvider,
  ]);

  if (quotesError) {
    console.error('quotesError', quotesError);
  }

  const {
    value: slippageValidInfo,
    // error: slippageValidError,
    loading: slippageValidLoading,
  } = useAsync(async () => {
    if (chain && Number(slippage) && payToken?.id && receiveToken?.id) {
      return validSlippage({
        chain,
        slippage,
        payTokenId: payToken?.id,
        receiveTokenId: receiveToken?.id,
      });
    }
  }, [slippage, chain, payToken?.id, receiveToken?.id, refreshId]);

  const { setSwapSortIncludeGasFee } = useSwapSettings();

  const openQuote = useSetQuoteVisible();

  const openQuotesList = useCallback(() => {
    setQuotesList([]);
    setRefreshId(e => e + 1);
    openQuote(true);
    setSwapSortIncludeGasFee(true);
  }, [openQuote, setRefreshId, setSwapSortIncludeGasFee]);

  useEffect(() => {
    if (expiredTimer.current) {
      clearTimeout(expiredTimer.current);
    }
    setExpired(false);
    setActiveProvider(undefined);
    setSlippageChanged(false);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payToken?.id, receiveToken?.id, chain, payAmount, inSufficient]);

  // const { search } = useLocation();
  const search = {};
  // const query2obj = ()=>
  const [searchObj] = useState<{
    payTokenId?: string;
    chain?: string;
  }>(
    // query2obj(search)
    search,
  );

  useEffect(() => {
    if (searchObj.chain && searchObj.payTokenId) {
      const target = Object.values(CHAINS).find(
        item => item.serverId === searchObj.chain,
      );
      if (target) {
        setChain(target?.enum);
        setPayToken({
          ...getChainDefaultToken(target?.enum),
          id: searchObj.payTokenId,
        });
        setReceiveToken(undefined);
      }
    }
  }, [searchObj?.chain, searchObj?.payTokenId, setPayToken, setReceiveToken]);

  // const rbiSource = useRbiSource();

  useEffect(() => {
    // if (rbiSource) {
    stats.report('enterSwapDescPage', {
      // refer: rbiSource,
    });
    // }
  }, []);

  return {
    bestQuoteDex,
    chain,
    switchChain,

    payToken,
    setPayToken,
    receiveToken,
    setReceiveToken,
    exchangeToken,
    payTokenIsNativeToken,

    handleAmountChange,
    handleBalance,
    payAmount,

    isWrapToken,
    wrapTokenSymbol,
    inSufficient,
    slippageChanged,
    setSlippageChanged,
    slippageState,
    slippage,
    setSlippage,
    feeRate,
    isSlippageHigh,
    isSlippageLow,

    //quote
    openQuotesList,
    quoteLoading,
    quoteList,
    currentProvider,
    setActiveProvider,

    slippageValidInfo,
    slippageValidLoading,

    expired,

    gasLevel,
    gasLimit,
    changeGasPrice,
    gasList,
    reserveGasOpen,
    closeReserveGasOpen,
  };
};

function getChainDefaultToken(chain: CHAINS_ENUM) {
  const chainInfo = CHAINS[chain];
  return {
    id: chainInfo.nativeTokenAddress,
    decimals: chainInfo.nativeTokenDecimals,
    logo_url: chainInfo.nativeTokenLogo,
    symbol: chainInfo.nativeTokenSymbol,
    display_symbol: chainInfo.nativeTokenSymbol,
    optimized_symbol: chainInfo.nativeTokenSymbol,
    is_core: true,
    is_verified: true,
    is_wallet: true,
    amount: 0,
    price: 0,
    name: chainInfo.nativeTokenSymbol,
    chain: chainInfo.serverId,
    time_at: 0,
  } as TokenItem;
}

function tokenAmountBn(token: TokenItem) {
  return new BigNumber(token?.raw_amount_hex_str || 0, 16).div(
    10 ** (token?.decimals || 1),
  );
}

export const useDetectLoss = ({
  receiveRawAmount: receiveAmount,
  payAmount,
  payToken,
  receiveToken,
}: {
  payAmount: string;
  receiveRawAmount: string | number;
  payToken?: TokenItem;
  receiveToken?: TokenItem;
}) => {
  return useMemo(() => {
    if (!payToken || !receiveToken) {
      return false;
    }
    const pay = new BigNumber(payAmount).times(payToken.price || 0);
    const receiveAll = new BigNumber(receiveAmount);
    const receive = receiveAll.times(receiveToken.price || 0);
    const cut = receive.minus(pay).div(pay).times(100);

    return cut.lte(-5);
  }, [payAmount, payToken, receiveAmount, receiveToken]);
};
