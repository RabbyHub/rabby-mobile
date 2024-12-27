import { CHAINS, CHAINS_ENUM } from '@debank/common';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { WrapTokenAddressMap } from '@rabby-wallet/rabby-swap';
import BigNumber from 'bignumber.js';
import { useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { refreshIdAtom, useSetQuoteVisible } from './atom';
import useAsync from 'react-use/lib/useAsync';
import { openapi } from '@/core/request';
import useDebounce from 'react-use/lib/useDebounce';
import { swapService } from '@/core/services';
import { useAsyncInitializeChainList } from '@/hooks/useChain';
import { SWAP_SUPPORT_CHAINS } from '@/constant/swap';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useSwapSettings } from './settings';
import { QuoteProvider, TDexQuoteData, useQuoteMethods } from './quote';
import { stats } from '@/utils/stats';
import { formatSpeicalAmount } from '@/utils/number';
import { getTokenSymbol } from '@/utils/token';
import { useDebounceFn, useRequest } from 'ahooks';
import { findChainByEnum } from '@/utils/chain';
import { useSlippageStore } from './slippage';
import { apiProvider } from '@/core/apis';
import { useSwapRecentToTokens } from './recent';
import { useLowCreditState } from '../components/LowCreditModal';
import { trigger } from 'react-native-haptic-feedback';

const sliderHapticTriggerNumbers = [0, 50, 100];

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
  const [token, setToken] = useState<
    (TokenItem & { tokenId?: string }) | undefined
  >(defaultToken);

  const { value, loading, error } = useAsync(async () => {
    if (userAddress && token?.id && chain) {
      const data = await openapi.getToken(
        userAddress,
        findChainByEnum(chain)?.serverId || CHAINS[chain].serverId,
        token.id,
      );
      return { ...data, tokenId: token.id };
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
  const refreshId = useAtomValue(refreshIdAtom);
  const setRefreshId = useSetAtom(refreshIdAtom);

  const [showMoreVisible, setShowMoreVisible] = useState(false);

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
    swapService.setSelectedChain(c);
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

  const clearExpiredTimer = useCallback(() => {
    if (expiredTimer.current) {
      clearTimeout(expiredTimer.current);
    }
  }, []);

  useEffect(() => {
    return () => {
      clearExpiredTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setActiveProvider: React.Dispatch<
    React.SetStateAction<QuoteProvider | undefined>
  > = useCallback(
    p => {
      if (expiredTimer.current) {
        clearTimeout(expiredTimer.current);
      }
      expiredTimer.current = setTimeout(() => {
        setRefreshId(e => e + 1);
      }, 1000 * 20);
      setOriActiveProvider(p);
    },
    [setRefreshId],
  );

  const [payToken, setPayToken] = useTokenInfo({
    userAddress,
    chain,
    defaultToken: defaultSelectedFromToken || getChainDefaultToken(chain),
  });
  const [receiveToken, _setReceiveToken] = useTokenInfo({
    userAddress,
    chain,
    defaultToken: defaultSelectedToToken,
  });

  const [_, setRecentSwapToToken] = useSwapRecentToTokens();
  const {
    lowCreditToken,
    lowCreditVisible,
    setLowCreditToken,
    setLowCreditVisible,
  } = useLowCreditState();

  const setReceiveToken = useCallback(
    (token: TokenItem | undefined) => {
      _setReceiveToken(token);
      if (token) {
        setRecentSwapToToken(token);
        if (token?.low_credit_score) {
          setLowCreditToken(token);
          setLowCreditVisible(true);
        }
      }
    },
    [
      _setReceiveToken,
      setLowCreditToken,
      setLowCreditVisible,
      setRecentSwapToToken,
    ],
  );

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
      setSlider(0);
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
    swapService.setSelectedFromToken(payToken);
  }, [payToken]);

  useEffect(() => {
    swapService.setSelectedToToken(receiveToken);
  }, [receiveToken]);

  const exchangeToken = useCallback(() => {
    setPayToken(receiveToken);
    setReceiveToken(payToken);
    setPayAmount('');
    setSlider(0);
  }, [setPayToken, receiveToken, setReceiveToken, payToken]);

  if (payToken && receiveToken && payToken?.id === receiveToken?.id) {
    setReceiveToken(undefined);
  }

  const payTokenIsNativeToken = useMemo(() => {
    if (payToken) {
      return isSameAddress(payToken.id, chainInfo.nativeTokenAddress);
    }
    return false;
  }, [chainInfo?.nativeTokenAddress, payToken]);

  /* Gas */

  const [passGasPrice, setUseGasPrice] = useState(false);

  const gasLimit = useMemo(
    () => (chain === CHAINS_ENUM.ETH ? 1000000 : 2000000),
    [chain],
  );

  const { value: gasList } = useAsync(() => {
    return apiProvider.gasMarketV2({
      chainId: chainInfo.serverId,
    });
  }, [chainInfo?.serverId]);

  const normalGasPrice = useMemo(
    () => gasList?.find(e => e.level === 'normal')?.price,
    [gasList],
  );

  const nativeTokenDecimals = useMemo(
    () => findChainByEnum(chain)?.nativeTokenDecimals || 1e18,
    [chain],
  );

  /* Gas end */

  const handleAmountChange = useCallback(
    (e: string) => {
      const v = formatSpeicalAmount(e);
      if (!/^\d*(\.\d*)?$/.test(v)) {
        return;
      }
      setPayAmount(v);
      if (payToken) {
        const slider = v
          ? Number(
              new BigNumber(v || 0)
                .div(tokenAmountBn(payToken))
                .times(100)
                .toFixed(0),
            )
          : 0;
        setSlider(slider < 0 ? 0 : slider > 100 ? 100 : slider);
      }
      setUseGasPrice(false);
      setSwapUseSlider(false);
    },
    [payToken, setUseGasPrice],
  );

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

  const setQuote = useCallback(
    (id: number) => (quote: TDexQuoteData) => {
      if (id === fetchIdRef.current) {
        setQuotesList(e => {
          const index = e.findIndex(q => q.name === quote.name);
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
        !inSufficient &&
        !isDraggingSlider
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
          payAmount,
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
        setShowMoreVisible(true);
      },
    },
  );

  const { run: runGetAllQuotes } = useDebounceFn(_runGetAllQuotes, {
    wait: 1000,
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
      runGetAllQuotes();
    } else {
      setActiveProvider(undefined);
      setQuoteLoading(false);
    }
  }, [
    userAddress,
    payToken?.id,
    receiveToken?.id,
    chain,
    feeRate,
    inSufficient,
    receiveToken,
    payAmount,
    runGetAllQuotes,
    setActiveProvider,
  ]);

  const canUpdateActiveProvider = useMemo(() => {
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
      return true;
    }
    return false;
  }, [
    chain,
    feeRate,
    inSufficient,
    payAmount,
    payToken?.id,
    receiveToken,
    userAddress,
  ]);

  useEffect(() => {
    setQuotesList([]);
  }, [payToken?.id, receiveToken?.id, chain, payAmount, inSufficient]);

  useEffect(() => {
    if (
      !quoteLoading &&
      receiveToken &&
      canUpdateActiveProvider &&
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
            const balanceChangeReceiveTokenAmount =
              quote?.preExecResult.swapPreExecTx.balance_change.receive_token_list.find(
                token => isSameAddress(token.id, receiveToken.id),
              )?.amount || 0;

            if (sortIncludeGasFee) {
              return new BigNumber(balanceChangeReceiveTokenAmount)
                .times(price)
                .minus(quote?.preExecResult?.gasUsdValue || 0);
            }

            return new BigNumber(balanceChangeReceiveTokenAmount).times(price);
          };
          return getNumber(b).minus(getNumber(a)).toNumber();
        }) || []),
      ];

      if (sortedList?.[0]) {
        const bestQuote = sortedList[0];
        const { preExecResult } = bestQuote;

        setBestQuoteDex(bestQuote.name);

        setActiveProvider(
          !bestQuote.preExecResult || !bestQuote.preExecResult.isSdkPass
            ? undefined
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
                  preExecResult?.swapPreExecTx.balance_change.receive_token_list.find(
                    token => isSameAddress(token.id, receiveToken.id),
                  )?.amount || '',
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
    setActiveProvider,
    canUpdateActiveProvider,
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
    openQuote(true);
    setSwapSortIncludeGasFee(true);
  }, [openQuote, setSwapSortIncludeGasFee]);

  useEffect(() => {
    if (expiredTimer.current) {
      clearTimeout(expiredTimer.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payToken?.id, receiveToken?.id, chain, payAmount, inSufficient]);

  const search = {};
  const [searchObj] = useState<{
    payTokenId?: string;
    chain?: string;
  }>(search);

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

  useEffect(() => {
    // if (rbiSource) {
    stats.report('enterSwapDescPage', {
      // refer: rbiSource,
    });
    // }
  }, []);

  /* slider */
  const [slider, setSlider] = useState<number>(0);

  const [swapUseSlider, setSwapUseSlider] = useState<boolean>(false);

  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false);

  const handleSlider100 = useCallback(() => {
    if (payToken) {
      setUseGasPrice(false);
      setPayAmount(tokenAmountBn(payToken).toString(10));
    }
    if (payTokenIsNativeToken && payToken) {
      if (normalGasPrice) {
        const val = tokenAmountBn(payToken).minus(
          new BigNumber(gasLimit)
            .times(normalGasPrice)
            .div(10 ** nativeTokenDecimals),
        );
        if (!val.lt(0)) {
          setUseGasPrice(true);
        }
        setPayAmount(
          val.lt(0) ? tokenAmountBn(payToken).toString(10) : val.toString(10),
        );
      }
    }
  }, [
    payToken,
    payTokenIsNativeToken,
    normalGasPrice,
    gasLimit,
    nativeTokenDecimals,
  ]);

  const previousSlider = useRef<number>(0);

  const onChangeSlider = useCallback(
    (v: number, syncAmount?: boolean) => {
      if (payToken) {
        setIsDraggingSlider(true);
        setSwapUseSlider(true);
        setSlider(v);

        if (
          v !== previousSlider.current &&
          sliderHapticTriggerNumbers.includes(v)
        ) {
          trigger('impactLight', {
            enableVibrateFallback: true,
            ignoreAndroidSystemSettings: false,
          });
        }

        if (syncAmount) {
          setIsDraggingSlider(false);
        }

        previousSlider.current = v;

        if (v === 100) {
          handleSlider100();
          return;
        }
        setPayAmount(
          new BigNumber(v).div(100).times(tokenAmountBn(payToken)).toString(10),
        );
      }
    },
    [handleSlider100, payToken],
  );

  /* slider end*/

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

    gasLimit,
    gasList,
    passGasPrice,

    isDraggingSlider,
    slider,
    swapUseSlider,
    onChangeSlider,

    showMoreVisible,

    lowCreditToken,
    lowCreditVisible,
    setLowCreditToken,
    setLowCreditVisible,

    clearExpiredTimer,
  };
};

function getChainDefaultToken(chain: CHAINS_ENUM) {
  const chainInfo = findChainByEnum(chain) || CHAINS[chain];
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
