import { CHAINS, CHAINS_ENUM } from '@debank/common';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { WrapTokenAddressMap } from '@rabby-wallet/rabby-swap';
import BigNumber from 'bignumber.js';
import { atom, useAtomValue, useSetAtom } from 'jotai';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { refreshIdAtom } from './atom';
import useAsync from 'react-use/lib/useAsync';
import { openapi } from '@/core/request';
import useDebounce from 'react-use/lib/useDebounce';
import { swapService } from '@/core/services';
import { useAsyncInitializeChainList } from '@/hooks/useChain';
import { getChainDefaultToken, SWAP_SUPPORT_CHAINS } from '@/constant/swap';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useSwapSettings } from './settings';
import { QuoteProvider, TDexQuoteData, useQuoteMethods } from './quote';
import { stats } from '@/utils/stats';
import { formatTokenAmountInput } from '@/utils/number';
import { getTokenSymbol, isTokenMarketClosed } from '@/utils/token';
import { useDebounceFn, useRequest } from 'ahooks';
import { findChainByEnum } from '@/utils/chain';
import { getSwapAutoSlippageValue, useSlippageStore } from './slippage';
import { useLowCreditState } from '../components/LowCreditModal';
import { trigger } from 'react-native-haptic-feedback';
import { apiProvider } from '@/core/apis';
import { getGasTokenBalance } from '@/core/apis/transactions';
import { isSwapWrapToken } from '../utils';
import { RequestRateLimiter } from './rateLimit';
import { useFocusEffect } from '@react-navigation/native';
import { eventBus, EVENTS } from '@/utils/events';
import { Account } from '@/core/services/preference';
import { useAutoSlippageEffect } from './autoSlippageEffect';
import { useClearMiniGasStateEffect } from '@/hooks/miniSignGasStore';
import {
  getQuotePollingResumeDelay,
  shouldScheduleQuotePolling,
} from '@/utils/quotePolling';
import { isGasAccountDepositFlowActive } from '@/screens/GasAccount/utils/depositFlowRuntime';
import { convert18RawToTokenRaw, isTempoChain } from '@/utils/tempo';

export const enableInsufficientQuote = true;

const sliderHapticTriggerNumbers = [0, 50, 100];
const SWAP_QUOTE_REFRESH_INTERVAL = 1000 * 20;
const EARLY_QUOTE_DISPLAY_MIN_TO_FROM_USD_RATIO = 0.03;

const { isSameAddress } = addressUtils;

const tokenRefreshIdAtom = atom(0);
const useTokenRefreshId = () => useAtomValue(tokenRefreshIdAtom);
const useSetTokenRefreshId = () => useSetAtom(tokenRefreshIdAtom);

const getSwapQuoteScore = ({
  quote,
  receiveToken,
  inSufficient,
}: {
  quote: TDexQuoteData;
  receiveToken: TokenItem;
  inSufficient: boolean;
}) => {
  if (
    quote.loading ||
    !quote.data?.toTokenAmount ||
    !quote.preExecResult?.isSdkPass
  ) {
    return null;
  }

  const price = receiveToken.price ? receiveToken.price : 1;
  const receiveTokenAmount = new BigNumber(quote.data.toTokenAmount).div(
    10 ** (quote.data.toTokenDecimals || receiveToken.decimals),
  );
  const amountUsd = receiveTokenAmount.times(price);

  if (inSufficient) {
    return amountUsd;
  }

  return amountUsd.minus(quote.preExecResult.gasUsdValue || 0);
};

const getSwapProviderScore = ({
  provider,
  receiveToken,
  inSufficient,
}: {
  provider: QuoteProvider;
  receiveToken: TokenItem;
  inSufficient: boolean;
}) => {
  if (!provider.quote?.toTokenAmount || !provider.preExecResult?.isSdkPass) {
    return null;
  }

  const price = receiveToken.price ? receiveToken.price : 1;
  const receiveTokenAmount = new BigNumber(provider.quote.toTokenAmount).div(
    10 ** (provider.quote.toTokenDecimals || receiveToken.decimals),
  );
  const amountUsd = receiveTokenAmount.times(price);

  if (inSufficient) {
    return amountUsd;
  }

  return amountUsd.minus(provider.preExecResult.gasUsdValue || 0);
};

const getTokenUsdValue = ({
  token,
  amount,
}: {
  token?: TokenItem;
  amount: string;
}) => new BigNumber(amount || 0).times(token?.price || 0);

const getSwapQuoteToTokenUsdValue = ({
  quote,
  receiveToken,
}: {
  quote: TDexQuoteData;
  receiveToken: TokenItem;
}) => {
  if (!quote.data?.toTokenAmount) {
    return new BigNumber(0);
  }

  return new BigNumber(quote.data.toTokenAmount)
    .div(
      new BigNumber(10).pow(
        quote.data.toTokenDecimals || receiveToken.decimals,
      ),
    )
    .times(receiveToken.price || 0);
};

const getSwapProviderToTokenUsdValue = ({
  provider,
  receiveToken,
}: {
  provider: QuoteProvider;
  receiveToken: TokenItem;
}) => {
  if (!provider.quote?.toTokenAmount) {
    return new BigNumber(0);
  }

  return new BigNumber(provider.quote.toTokenAmount)
    .div(
      new BigNumber(10).pow(
        provider.quote.toTokenDecimals || receiveToken.decimals,
      ),
    )
    .times(receiveToken.price || 0);
};

const canDisplayEarlyQuoteByUsdValue = ({
  fromToken,
  fromAmount,
  toUsdValue,
}: {
  fromToken?: TokenItem;
  fromAmount: string;
  toUsdValue: BigNumber;
}) => {
  const fromUsdValue = getTokenUsdValue({
    token: fromToken,
    amount: fromAmount,
  });

  if (!fromUsdValue.gt(0)) {
    return true;
  }

  return toUsdValue.gte(
    fromUsdValue.times(EARLY_QUOTE_DISPLAY_MIN_TO_FROM_USD_RATIO),
  );
};

const canDisplaySwapQuoteBeforeAllQuotesLoaded = ({
  quote,
  payToken,
  payAmount,
  receiveToken,
}: {
  quote: TDexQuoteData;
  payToken?: TokenItem;
  payAmount: string;
  receiveToken: TokenItem;
}) =>
  canDisplayEarlyQuoteByUsdValue({
    fromToken: payToken,
    fromAmount: payAmount,
    toUsdValue: getSwapQuoteToTokenUsdValue({ quote, receiveToken }),
  });

const canDisplaySwapProviderBeforeAllQuotesLoaded = ({
  provider,
  payToken,
  payAmount,
  receiveToken,
}: {
  provider: QuoteProvider;
  payToken?: TokenItem;
  payAmount: string;
  receiveToken: TokenItem;
}) =>
  canDisplayEarlyQuoteByUsdValue({
    fromToken: payToken,
    fromAmount: payAmount,
    toUsdValue: getSwapProviderToTokenUsdValue({ provider, receiveToken }),
  });

const getBestSwapQuote = ({
  quoteList,
  receiveToken,
  inSufficient,
}: {
  quoteList: TDexQuoteData[];
  receiveToken: TokenItem;
  inSufficient: boolean;
}) => {
  return quoteList.reduce<
    | {
        quote: TDexQuoteData;
        score: BigNumber;
      }
    | undefined
  >((best, quote) => {
    const score = getSwapQuoteScore({ quote, receiveToken, inSufficient });
    if (!score) {
      return best;
    }

    if (!best || score.gt(best.score)) {
      return { quote, score };
    }

    return best;
  }, undefined);
};

const createSwapQuoteProvider = ({
  quote,
  receiveToken,
}: {
  quote: TDexQuoteData;
  receiveToken: TokenItem;
}): QuoteProvider => {
  const { preExecResult } = quote;

  return {
    name: quote.name,
    quote: quote.data,
    preExecResult: quote.preExecResult,
    gasPrice: preExecResult?.gasPrice,
    shouldApproveToken: !!preExecResult?.shouldApproveToken,
    shouldTwoStepApprove: !!preExecResult?.shouldTwoStepApprove,
    error: !preExecResult,
    halfBetterRate: '',
    quoteWarning: undefined,
    actualReceiveAmount:
      new BigNumber(quote.data?.toTokenAmount || 0)
        .div(10 ** (quote.data?.toTokenDecimals || receiveToken.decimals))
        .toString() || '',
    gasUsd: preExecResult?.gasUsd,
  };
};

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
  }, [tokenRefreshId, userAddress, token?.id, chain]);

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
  const [quotesListVisible, setQuotesListVisible] = useState(false);

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

  const expiredTimer = useRef<NodeJS.Timeout>(undefined);
  const autoQuoteRefreshDeadlineRef = useRef<number | null>(null);
  const autoQuoteRefreshPausedRef = useRef(false);
  const reloadTxRefreshPausedRef = useRef(false);
  const enableRefreshRef = useRef(false);

  const stopExpiredTimer = useCallback(() => {
    if (expiredTimer.current) {
      clearTimeout(expiredTimer.current);
      expiredTimer.current = undefined;
    }
  }, []);

  const clearExpiredTimer = useCallback(() => {
    stopExpiredTimer();
    autoQuoteRefreshDeadlineRef.current = null;
  }, [stopExpiredTimer]);

  const runScheduledQuoteRefresh = useCallback(() => {
    expiredTimer.current = undefined;

    if (autoQuoteRefreshPausedRef.current) {
      return;
    }

    autoQuoteRefreshDeadlineRef.current = null;
    if (
      shouldScheduleQuotePolling({
        enabled: enableRefreshRef.current,
        paused: false,
      })
    ) {
      setRefreshId(e => e + 1);
    }
  }, [setRefreshId]);

  const scheduleQuoteRefresh = useCallback(
    (delay: number) => {
      stopExpiredTimer();
      autoQuoteRefreshDeadlineRef.current = Date.now() + delay;

      if (autoQuoteRefreshPausedRef.current) {
        return;
      }

      expiredTimer.current = setTimeout(runScheduledQuoteRefresh, delay);
    },
    [runScheduledQuoteRefresh, stopExpiredTimer],
  );

  const resumeQuoteRefresh = useCallback(() => {
    const delay = getQuotePollingResumeDelay({
      deadline: autoQuoteRefreshDeadlineRef.current,
    });

    if (delay === null) {
      return;
    }

    if (delay <= 0) {
      runScheduledQuoteRefresh();
      return;
    }

    stopExpiredTimer();
    expiredTimer.current = setTimeout(runScheduledQuoteRefresh, delay);
  }, [runScheduledQuoteRefresh, stopExpiredTimer]);

  const setAutoQuoteRefreshPaused = useCallback(
    (paused: boolean) => {
      if (autoQuoteRefreshPausedRef.current === paused) {
        return;
      }

      autoQuoteRefreshPausedRef.current = paused;
      if (paused) {
        stopExpiredTimer();
        return;
      }

      resumeQuoteRefresh();
    },
    [resumeQuoteRefresh, stopExpiredTimer],
  );

  const setReloadTxRefreshPaused = useCallback((paused: boolean) => {
    reloadTxRefreshPausedRef.current = paused;
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
      clearExpiredTimer();

      setOriActiveProvider(pre => {
        enableRefreshRef.current = p ? true : false;
        if (typeof p === 'function') {
          const result = p(pre);
          enableRefreshRef.current = result ? true : false;

          return result;
        }

        return p;
      });

      scheduleQuoteRefresh(SWAP_QUOTE_REFRESH_INTERVAL);
    },
    [clearExpiredTimer, scheduleQuoteRefresh],
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

  const isTempoSwapChain = useMemo(
    () => isTempoChain(chainInfo.serverId),
    [chainInfo.serverId],
  );

  const { value: tempoGasTokenInfo, loading: isTempoGasTokenLoading } =
    useAsync(async () => {
      if (!userAddress || !isTempoSwapChain) {
        return null;
      }

      return getGasTokenBalance({
        account,
        address: userAddress,
        chainId: chainInfo.id,
      });
    }, [account, userAddress, chainInfo.id, refreshId, isTempoSwapChain]);

  const payTokenIsTempoFeeToken = useMemo(() => {
    if (
      !isTempoSwapChain ||
      !payToken?.id ||
      !tempoGasTokenInfo?.token.tokenId
    ) {
      return false;
    }

    return isSameAddress(payToken.id, tempoGasTokenInfo.token.tokenId);
  }, [isTempoSwapChain, payToken?.id, tempoGasTokenInfo?.token.tokenId]);

  const payTokenIsGasToken = useMemo(
    () => payTokenIsNativeToken || payTokenIsTempoFeeToken,
    [payTokenIsNativeToken, payTokenIsTempoFeeToken],
  );

  /* Gas */

  const [passGasPrice, setUseGasPrice] = useState(false);

  const gasLimit = useMemo(
    () => (chain === CHAINS_ENUM.ETH ? 1000000 : 2000000),
    [chain],
  );

  const { value: gasList, loading: isGasMarketLoading } = useAsync(() => {
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

  const gasTokenDecimals = useMemo(() => {
    if (payTokenIsNativeToken) {
      return nativeTokenDecimals;
    }

    if (payTokenIsTempoFeeToken) {
      return tempoGasTokenInfo?.token.decimals || payToken?.decimals || 18;
    }

    return undefined;
  }, [
    nativeTokenDecimals,
    payTokenIsNativeToken,
    payTokenIsTempoFeeToken,
    payToken?.decimals,
    tempoGasTokenInfo?.token.decimals,
  ]);

  /* Gas end */

  const handleAmountChange = useCallback(
    (e: string) => {
      const v = formatTokenAmountInput(e, payToken?.decimals);
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
  const quoteBlockedByClosedMarket = useMemo(
    () => isTokenMarketClosed(payToken) || isTokenMarketClosed(receiveToken),
    [payToken, receiveToken],
  );
  const canRequestQuote = useMemo(
    () => inSufficientCanGetQuote && !quoteBlockedByClosedMarket,
    [inSufficientCanGetQuote, quoteBlockedByClosedMarket],
  );
  const canRunQuoteRequest =
    !!(
      userAddress &&
      payToken?.id &&
      receiveToken?.id &&
      chain &&
      Number(payAmount) > 0 &&
      feeRate
    ) && canRequestQuote;

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
  const [quoteRequestId, setQuoteRequestId] = useState(0);
  const { getAllQuotes, validSlippage } = useQuoteMethods();
  const [finishedQuotes, setFinishedQuotes] = useState(0);

  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteRequestFinished, setQuoteRequestFinished] = useState(true);

  const rateLimitRef = useRef(new RequestRateLimiter(1000 * 30, 10));

  const [rateLimit, setRateLimit] = useState(false);

  const { error: quotesError, runAsync: _runGetAllQuotes } = useRequest(
    async (currentFetchId: number) => {
      if (canRunQuoteRequest && !isDraggingSlider) {
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
        // wait for progress animation finish
        setTimeout(() => {
          if (params[0] === fetchIdRef.current) {
            setQuoteRequestFinished(true);
            setQuoteLoading(false);
            setShowMoreVisible(true);
            setFinishedQuotes(0);
          }
        }, 300);
      },
    },
  );

  const { run: runGetAllQuotes } = useDebounceFn(_runGetAllQuotes, {
    wait: rateLimit ? 5000 : 300,
  });

  useLayoutEffect(() => {
    fetchIdRef.current += 1;
    setQuoteRequestId(fetchIdRef.current);
    setQuotesList([]);
    setActiveProvider(undefined);
    setBestQuoteDex('');
    setFinishedQuotes(0);
    if (canRunQuoteRequest) {
      setQuoteRequestFinished(false);
      setQuoteLoading(true);
      runGetAllQuotes(fetchIdRef.current);
    } else {
      setQuoteRequestFinished(true);
      setQuoteLoading(false);
    }
  }, [
    canRunQuoteRequest,
    canRequestQuote,
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

  const canUpdateActiveProvider = canRunQuoteRequest;

  useEffect(() => {
    if (!receiveToken?.id || !canUpdateActiveProvider) {
      return;
    }

    const selectableQuoteList = quoteRequestFinished
      ? quoteList
      : quoteList.filter(quote =>
          canDisplaySwapQuoteBeforeAllQuotesLoaded({
            quote,
            payToken,
            payAmount,
            receiveToken,
          }),
        );

    const best = getBestSwapQuote({
      quoteList: selectableQuoteList,
      receiveToken,
      inSufficient,
    });

    if (!best) {
      return;
    }

    setQuoteLoading(false);
    setShowMoreVisible(true);
    setBestQuoteDex(best.quote.name);

    const currentProviderScore = currentProvider
      ? getSwapProviderScore({
          provider: currentProvider,
          receiveToken,
          inSufficient,
        })
      : null;
    const currentProviderLoaded =
      !!currentProvider &&
      quoteList.some(
        quote => !quote.loading && quote.name === currentProvider.name,
      );

    if (currentProviderLoaded && currentProvider.manualClick) {
      const canDisplayCurrentProvider =
        quoteRequestFinished ||
        canDisplaySwapProviderBeforeAllQuotesLoaded({
          provider: currentProvider,
          payToken,
          payAmount,
          receiveToken,
        });

      if (canDisplayCurrentProvider) {
        return;
      }
    }

    if (
      currentProviderLoaded &&
      currentProviderScore &&
      !best.score.gt(currentProviderScore)
    ) {
      return;
    }

    setActiveProvider(
      createSwapQuoteProvider({
        quote: best.quote,
        receiveToken,
      }),
    );
    // ignore receiveToken price update
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    quoteList,
    inSufficient,
    setActiveProvider,
    canUpdateActiveProvider,
    currentProvider,
    payToken,
    payAmount,
    quoteRequestFinished,
    receiveToken?.id,
    receiveToken?.chain,
    receiveToken?.price,
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

  const openQuotesList = useCallback(() => {
    setQuotesListVisible(true);
    setSwapSortIncludeGasFee(true);
  }, [setSwapSortIncludeGasFee]);

  const closeQuotesList = useCallback(() => {
    setQuotesListVisible(false);
  }, []);

  useEffect(() => {
    clearExpiredTimer();
  }, [
    payToken?.id,
    receiveToken?.id,
    chain,
    payAmount,
    clearExpiredTimer,
    setActiveProvider,
  ]);

  useEffect(() => {
    setActiveProvider(undefined);
  }, [payToken?.id, receiveToken?.id, chain, setActiveProvider]);

  useEffect(() => {
    if (!enableInsufficientQuote || !payAmount || Number(payAmount) === 0) {
      setActiveProvider(undefined);
    }
  }, [payAmount, setActiveProvider]);

  useEffect(() => {
    if (!canRequestQuote) {
      clearExpiredTimer();
      setQuotesList([]);
      setActiveProvider(undefined);
    }
  }, [canRequestQuote, clearExpiredTimer, setActiveProvider]);

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
    if (!payToken) {
      return;
    }

    setUseGasPrice(false);
    const fullAmount = tokenAmountBn(payToken);
    if (
      payTokenIsGasToken &&
      gasTokenDecimals !== undefined &&
      normalGasPrice
    ) {
      const val = fullAmount.minus(
        convert18RawToTokenRaw(
          new BigNumber(gasLimit).times(normalGasPrice),
          gasTokenDecimals,
        ).div(new BigNumber(10).pow(gasTokenDecimals)),
      );
      if (!val.lt(0)) {
        setUseGasPrice(true);
      }
      setPayAmount(val.lt(0) ? fullAmount.toString(10) : val.toString(10));
      return;
    }

    setPayAmount(fullAmount.toString(10));
  }, [
    payToken,
    payTokenIsGasToken,
    gasTokenDecimals,
    gasLimit,
    normalGasPrice,
  ]);

  useEffect(() => {
    if (
      slider === 100 &&
      swapUseSlider &&
      payToken?.amount &&
      !isGasMarketLoading &&
      (!isTempoSwapChain || !isTempoGasTokenLoading)
    ) {
      handleSlider100();
    }
  }, [
    slider,
    swapUseSlider,
    payToken?.amount,
    isGasMarketLoading,
    isTempoSwapChain,
    isTempoGasTokenLoading,
    handleSlider100,
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
        if (
          autoQuoteRefreshPausedRef.current ||
          reloadTxRefreshPausedRef.current ||
          isGasAccountDepositFlowActive()
        ) {
          return;
        }
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
    quoteBlockedByClosedMarket,
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
    closeQuotesList,
    quotesListVisible,
    quoteLoading,
    allQuotesLoaded: quoteRequestFinished,
    quoteRequestId,
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
    setAutoQuoteRefreshPaused,
    setReloadTxRefreshPaused,

    finishedQuotes,
    autoSuggestSlippage,
  };
};

function tokenAmountBn(token: TokenItem) {
  return new BigNumber(token?.raw_amount_hex_str || 0, 16).div(
    10 ** token.decimals,
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
