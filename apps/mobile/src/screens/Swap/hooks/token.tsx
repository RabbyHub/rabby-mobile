import { CHAINS, CHAINS_ENUM } from '@debank/common';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { WrapTokenAddressMap } from '@rabby-wallet/rabby-swap';
import BigNumber from 'bignumber.js';
import { atom, useAtomValue, useSetAtom } from 'jotai';
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
import { getSwapAutoSlippageValue, useSlippageStore } from './slippage';
import { useLowCreditState } from '../components/LowCreditModal';
import { trigger } from 'react-native-haptic-feedback';
import { apiProvider } from '@/core/apis';
import { isSwapWrapToken } from '../utils';
import { RequestRateLimiter } from './rateLimit';
import { useFocusEffect } from '@react-navigation/native';
import { eventBus, EVENTS } from '@/utils/events';
import { Account } from '@/core/services/preference';
import { useAutoSlippageEffect } from './autoSlippageEffect';
import { useClearMiniGasStateEffect } from '@/hooks/miniSignGasStore';

export const enableInsufficientQuote = true;

const sliderHapticTriggerNumbers = [0, 50, 100];

const { isSameAddress } = addressUtils;

const tokenRefreshIdAtom = atom(0);
const useTokenRefreshId = () => useAtomValue(tokenRefreshIdAtom);
const useSetTokenRefreshId = () => useSetAtom(tokenRefreshIdAtom);

const useTokenInfo = ({
  userAddress,
  chain,
  defaultToken,
}: {
  userAddress?: string;
  chain?: CHAINS_ENUM;
  defaultToken?: TokenItem;
}) => {
  const tokenRefreshId = useTokenRefreshId();
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
  }, [
    tokenRefreshId,
    userAddress,
    token?.id,
    token?.raw_amount_hex_str,
    chain,
  ]);

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

export const useTokenPair = ({ account }: { account: Account }) => {
  const userAddress = account?.address;
  const refreshId = useAtomValue(refreshIdAtom);
  const setTokenRefreshId = useSetTokenRefreshId();
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

  const { autoSlippage, setAutoSlippage } = useSlippageStore();

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

  const enableRefreshRef = useRef(false);

  const setActiveProvider: React.Dispatch<
    React.SetStateAction<QuoteProvider | undefined>
  > = useCallback(
    p => {
      if (expiredTimer.current) {
        clearTimeout(expiredTimer.current);
      }

      setOriActiveProvider(pre => {
        enableRefreshRef.current = p ? true : false;
        if (typeof p === 'function') {
          const result = p(pre);
          enableRefreshRef.current = result ? true : false;

          return result;
        }

        return p;
      });

      expiredTimer.current = setTimeout(() => {
        if (enableRefreshRef.current) {
          setRefreshId(e => e + 1);
        }
      }, 1000 * 20);
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
        if (token?.low_credit_score) {
          setLowCreditToken(token);
          setLowCreditVisible(true);
        }
      }
    },
    [_setReceiveToken, setLowCreditToken, setLowCreditVisible],
  );

  const [bestQuoteDex, setBestQuoteDex] = useState<string>('');

  const switchChain = useCallback(
    (
      c: CHAINS_ENUM,
      opts?: {
        payTokenId?: string;
        changeTo?: boolean;
        payUseBaseToken?: boolean;
      },
    ) => {
      handleChain(c);
      if (!opts?.changeTo) {
        setPayToken({
          ...getChainDefaultToken(c),
          ...(opts?.payTokenId ? { id: opts?.payTokenId } : {}),
        });
        if (opts?.payUseBaseToken) {
          setReceiveToken({
            ...getChainDefaultToken(c),
          });
        } else {
          setReceiveToken(undefined);
        }
      } else {
        setReceiveToken({
          ...getChainDefaultToken(c),
          ...(opts?.payTokenId ? { id: opts?.payTokenId } : {}),
        });
        if (opts?.payUseBaseToken) {
          setPayToken({
            ...getChainDefaultToken(c),
          });
        } else {
          setPayToken(undefined);
        }
      }
      setPayAmount('');
      setSlider(0);
      setActiveProvider(undefined);
    },
    [setActiveProvider, setPayToken, setReceiveToken],
  );

  const switchSwapAgain = useCallback(
    (c: CHAINS_ENUM, payTokenId: string, receiveTokenId: string) => {
      handleChain(c);
      setPayToken({
        ...getChainDefaultToken(c),
        id: payTokenId,
      });
      setReceiveToken({
        ...getChainDefaultToken(c),
        id: receiveTokenId,
      });
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
    account,
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

  useEffect(() => {
    if (payToken && receiveToken && payToken?.id === receiveToken?.id) {
      setReceiveToken(undefined);
    }
    //  only once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    return apiProvider.gasMarketV2(
      {
        chainId: chainInfo.serverId,
      },
      account,
    );
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
                .div(payToken?.amount ? tokenAmountBn(payToken) : 1)
                .times(100)
                .toFixed(0),
            )
          : 0;
        setSlider(slider < 0 ? 0 : slider > 100 ? 100 : slider);
        if (!payToken?.amount) {
          setSlider(0);
        }
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
      const res = isSwapWrapToken(payToken?.id, receiveToken?.id, chain);
      return [
        res,
        isSameAddress(payToken?.id, WrapTokenAddressMap[chain])
          ? getTokenSymbol(payToken)
          : getTokenSymbol(receiveToken),
      ];
    }
    return [false, ''];
  }, [payToken, receiveToken, chain]);

  const inSufficient = useMemo(
    () =>
      payToken
        ? tokenAmountBn(payToken).lt(payAmount)
        : new BigNumber(0).lt(payAmount),
    [payToken, payAmount],
  );

  const inSufficientCanGetQuote = enableInsufficientQuote
    ? true
    : !inSufficient;

  useEffect(() => {
    if (autoSlippage) {
      setSlippage(getSwapAutoSlippageValue(isStableCoin));
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

  const [autoSuggestSlippage, setAutoSuggestSlippage] = useState(
    getSwapAutoSlippageValue(isStableCoin),
  );

  const fetchIdRef = useRef(0);
  const { getAllQuotes, validSlippage } = useQuoteMethods();
  const [finishedQuotes, setFinishedQuotes] = useState(0);

  const [quoteLoading, setQuoteLoading] = useState(false);

  const rateLimitRef = useRef(new RequestRateLimiter(1000 * 30, 10));

  const [rateLimit, setRateLimit] = useState(false);

  const { error: quotesError, runAsync: _runGetAllQuotes } = useRequest(
    async (currentFetchId: number) => {
      if (
        userAddress &&
        payToken?.id &&
        receiveToken?.id &&
        receiveToken &&
        chain &&
        Number(payAmount) > 0 &&
        feeRate &&
        inSufficientCanGetQuote &&
        !isDraggingSlider
      ) {
        setTokenRefreshId(e => e + 1);
        const limit = rateLimitRef.current?.checkRateLimit();
        setRateLimit(!!limit);

        setQuotesList(e =>
          e.map(q => ({ ...q, loading: true, isBest: false })),
        );

        let realSlippage = slippage;
        if (autoSlippage) {
          try {
            const suggestSlippage = await openapi.suggestSlippage({
              chain_id: findChainByEnum(chain)!.serverId,
              slippage: Number(slippage || '0.1') / 100 + '',
              from_token_id: payToken.id,
              to_token_id: receiveToken.id,
              from_token_amount: payAmount,
            });

            console.debug('suggest_slippage', {
              suggestSlippage,
              current: slippage || '0.1',
            });

            realSlippage = suggestSlippage.suggest_slippage
              ? new BigNumber(suggestSlippage.suggest_slippage)
                  .times(100)
                  .toFixed()
              : slippage || '0.1';
            if (currentFetchId === fetchIdRef.current) {
              setAutoSuggestSlippage(realSlippage);
            }
          } catch (error) {
            console.log('suggest_slippage error', error);
          }
        }

        return getAllQuotes({
          userAddress,
          payToken,
          receiveToken,
          slippage: realSlippage || '0.1',
          chain,
          payAmount,
          fee: feeRate,
          setQuote: setQuote(currentFetchId),
          onFinishedQuote: () => {
            if (currentFetchId === fetchIdRef.current) {
              setFinishedQuotes(e => e + 1);
            }
          },
          inSufficient,
          account,
        });
      }
    },
    {
      manual: true,
      onFinally(params) {
        if (params[0] === fetchIdRef.current) {
          // wait for progress animation finish
          setTimeout(() => {
            setQuoteLoading(false);
            setShowMoreVisible(true);
            setFinishedQuotes(0);
          }, 300);
        }
      },
    },
  );

  const { run: runGetAllQuotes } = useDebounceFn(_runGetAllQuotes, {
    wait: rateLimit ? 5000 : 1000,
  });

  useEffect(() => {
    if (
      userAddress &&
      payToken?.id &&
      receiveToken?.id &&
      chain &&
      Number(payAmount) > 0 &&
      feeRate &&
      inSufficientCanGetQuote
    ) {
      setFinishedQuotes(0);
      setQuoteLoading(true);
      fetchIdRef.current += 1;
      runGetAllQuotes(fetchIdRef.current);
    } else {
      setFinishedQuotes(0);
      setActiveProvider(undefined);
      setQuoteLoading(false);
    }
  }, [
    inSufficientCanGetQuote,
    refreshId,
    userAddress,
    payToken?.id,
    receiveToken?.id,
    chain,
    feeRate,
    payAmount,
    runGetAllQuotes,
    setActiveProvider,
    // auto slippage
    slippage,
    autoSlippage,
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
      inSufficientCanGetQuote
    ) {
      return true;
    }
    return false;
  }, [
    inSufficientCanGetQuote,
    chain,
    feeRate,
    payAmount,
    payToken?.id,
    receiveToken,
    userAddress,
  ]);

  useEffect(() => {
    setQuotesList([]);
  }, [payToken?.id, receiveToken?.id, chain, payAmount]);

  useEffect(() => {
    if (
      !quoteLoading &&
      receiveToken?.id &&
      canUpdateActiveProvider &&
      quoteList.every(q => !q.loading)
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
              new BigNumber(quote.data?.toTokenAmount || 0)
                .div(
                  10 ** (quote?.data?.toTokenDecimals || receiveToken.decimals),
                )
                .toString() || 0;

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
                  new BigNumber(bestQuote.data?.toTokenAmount || 0)
                    .div(
                      10 **
                        (bestQuote?.data?.toTokenDecimals ||
                          receiveToken.decimals),
                    )
                    .toString() || '',
                gasUsd: preExecResult?.gasUsd,
              },
        );
      } else {
        setActiveProvider(undefined);
      }
    }
    // ignore receiveToken price update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    quoteList,
    quoteLoading,
    inSufficient,
    setActiveProvider,
    canUpdateActiveProvider,
    receiveToken?.id,
    receiveToken?.chain,
    // receiveToken?.price,
    receiveToken?.decimals,
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
  }, [payToken?.id, receiveToken?.id, chain, payAmount, setActiveProvider]);

  useEffect(() => {
    setActiveProvider(undefined);
  }, [payToken?.id, receiveToken?.id, chain, setActiveProvider]);

  useEffect(() => {
    if (!enableInsufficientQuote || !payAmount || Number(payAmount) === 0) {
      setActiveProvider(undefined);
    }
  }, [payAmount, setActiveProvider]);

  useEffect(() => {
    if (!inSufficientCanGetQuote) {
      clearTimeout(expiredTimer.current);
      setQuotesList([]);
      setActiveProvider(undefined);
    }
  }, [inSufficientCanGetQuote, setActiveProvider]);

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
        setUseGasPrice(false);

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
        const newAmountBn = new BigNumber(v)
          .div(100)
          .times(tokenAmountBn(payToken));
        const isTooSmall = newAmountBn.lt(0.0001);
        setPayAmount(
          isTooSmall
            ? newAmountBn.toString(10)
            : new BigNumber(newAmountBn.toFixed(4, 1)).toString(10),
        );
      }
    },
    [handleSlider100, payToken],
  );

  /* slider end*/

  useEffect(() => {
    setPayAmount('');
    setSlider(0);
    setSwapUseSlider(false);
    setIsDraggingSlider(false);
  }, [userAddress]);

  useFocusEffect(
    useCallback(() => {
      const refresh = () => {
        setTokenRefreshId(e => e + 1);
      };
      eventBus.addListener(EVENTS.RELOAD_TX, refresh);
      return () => {
        eventBus.removeListener(EVENTS.RELOAD_TX, refresh);
      };
    }, [setTokenRefreshId]),
  );

  const onSetAutoSlippage = useCallback(() => {
    setAutoSlippage(true);
  }, [setAutoSlippage]);

  useAutoSlippageEffect({
    chainServerId: findChainByEnum(chain)?.serverId || '',
    fromTokenId: payToken?.id || '',
    toTokenId: receiveToken?.id || '',
    onSetAutoSlippage,
  });

  useClearMiniGasStateEffect({
    chainServerId: findChainByEnum(chain)?.serverId || '',
  });

  return {
    bestQuoteDex,
    chain,
    switchChain,
    switchSwapAgain,

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
    inSufficientCanGetQuote,
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

    finishedQuotes,
    autoSuggestSlippage,
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
