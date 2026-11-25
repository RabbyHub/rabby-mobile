import { CHAINS, CHAINS_ENUM } from '@debank/common';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { WrapTokenAddressMap } from '@rabby-wallet/rabby-swap';
import BigNumber from 'bignumber.js';
import { useAtomValue } from 'jotai';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { refreshIdAtom } from './atom';
import { openapi } from '@/core/request';
import { useAsyncInitializeChainList } from '@/hooks/useChain';
import {
  getChainDefaultToken,
  getDefaultSwapToTokenItem,
  SWAP_SUPPORT_CHAINS,
} from '@/constant/swap';
import { addressUtils } from '@rabby-wallet/base-utils';
import { useSwapSettings } from './settings';
import type { QuoteProvider } from './quote';
import { useQuoteMethods } from './quote';
import { formatTokenAmountInput } from '@/utils/number';
import { getTokenSymbol, isTokenMarketClosed } from '@/utils/token';
import { findChainByEnum } from '@/utils/chain';
import { getSwapAutoSlippageValue, useSlippageStore } from './slippage';
import { useLowCreditState } from '../components/LowCreditModal';
import { trigger } from 'react-native-haptic-feedback';
import { apiProvider } from '@/core/apis';
import { getGasTokenBalance } from '@/core/apis/transactions';
import { getSwapGasReserveGasLimit, isSwapWrapToken } from '../utils';
import { useFocusEffect } from '@react-navigation/native';
import { eventBus, EVENTS } from '@/utils/events';
import type { Account } from '@/core/startupServices/preference';
import { useAutoSlippageEffect } from './autoSlippageEffect';
import { useClearMiniGasStateEffect } from '@/hooks/miniSignGasStore';
import { shouldScheduleQuotePolling } from '@/utils/quotePolling';
import { useScopedActivityStore } from '@/hooks/storeActivity/useActivityStore';
import {
  clearQuoteRefreshSession,
  pauseQuoteRefreshSession,
  quoteRefreshCountdownStore,
  resumeQuoteRefreshSession,
  scheduleQuoteRefreshSession,
} from './quoteRefreshScheduler';
import { isGasAccountDepositFlowActive } from '@/screens/GasAccount/utils/depositFlowRuntime';
import { convert18RawToTokenRaw, isTempoChain } from '@/utils/tempo';
import {
  shouldApplyInitialChainFallback,
  type PersistedSwapSelectionStatus,
} from './initialSelection';
import { useSwapService } from '../swapServiceDependencies';
import { useSceneActiveAsync } from '@/screens/SwapBridge/hooks/useSceneActiveAsync';
import { getRabbyFeeInfo } from './fee';
import { resolveSwapChainTokens } from './swapChainTokens';
import {
  applySwapQuoteProvider,
  beginSwapQuoteCycle,
  cancelSwapQuotePendingWork,
  clearSwapQuoteList,
  clearSwapQuoteSession,
  finishSwapQuoteCycle,
  getSwapQuoteFetchId,
  isSwapQuoteRefreshEnabled,
  markSwapQuoteCycleIdle,
  cancelSwapQuoteRequest,
  markSwapQuoteRequestLoading,
  pushSwapQuoteUpdate,
  scheduleSwapQuoteRequest,
  setSwapQuoteFetchRunner,
  resetSwapQuoteListOnInactive,
  setSwapQuoteRefreshScheduler,
  setSwapQuoteSelectionContext,
  useSwapQuoteActiveProvider,
  requestSwapQuoteRefresh,
  requestSwapTokenRefresh,
  setSwapQuoteCycleRunner,
  subscribeSwapTokenRefresh,
  useSwapQuoteBestDex,
  useSwapQuoteLoading,
} from './swapQuoteSession';

export {
  EARLY_QUOTE_DISPLAY_MIN_TO_FROM_USD_RATIO,
  getSwapQuoteScore,
} from './quoteSelection';

export const enableInsufficientQuote = true;

const sliderHapticTriggerNumbers = [0, 50, 100];
const SWAP_QUOTE_REFRESH_INTERVAL = 1000 * 20;

const { isSameAddress } = addressUtils;

const isSameTokenSnapshot = (prev?: TokenItem, next?: TokenItem) =>
  !!prev &&
  !!next &&
  prev.id === next.id &&
  prev.chain === next.chain &&
  prev.symbol === next.symbol &&
  prev.decimals === next.decimals &&
  prev.price === next.price &&
  prev.amount === next.amount &&
  prev.raw_amount_hex_str === next.raw_amount_hex_str &&
  prev.low_credit_score === next.low_credit_score;

const useTokenInfo = ({
  userAddress,
  chain,
  defaultToken,
  enabled,
}: {
  userAddress?: string;
  chain?: CHAINS_ENUM;
  defaultToken?: TokenItem;
  enabled: boolean;
}) => {
  const [token, setToken] = useState<
    (TokenItem & { tokenId?: string }) | undefined
  >(defaultToken);
  const tokenIdRef = useRef(token?.id);
  tokenIdRef.current = token?.id;
  const requestIdRef = useRef(0);

  const refreshToken = useCallback(() => {
    const tokenId = tokenIdRef.current;
    if (!enabled || !userAddress || !tokenId || !chain) {
      return;
    }
    const requestId = ++requestIdRef.current;
    openapi
      .getToken(
        userAddress,
        findChainByEnum(chain)?.serverId || CHAINS[chain].serverId,
        tokenId,
      )
      .then(data => {
        if (requestId !== requestIdRef.current) {
          return;
        }
        const next = { ...data, tokenId };
        // The periodic refresh usually returns an identical snapshot; keeping
        // the previous object identity avoids re-rendering the swap screen for
        // unchanged token data.
        setToken(prev =>
          isSameTokenSnapshot(prev, next) ? prev : (next as TokenItem),
        );
      })
      .catch(error => {
        console.error('token info error', chain, tokenId, error);
      });
  }, [chain, enabled, userAddress]);

  const refreshTokenRef = useRef(refreshToken);
  useEffect(() => {
    refreshTokenRef.current = refreshToken;
  }, [refreshToken]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    refreshToken();
  }, [enabled, refreshToken, token?.id]);

  useEffect(() => {
    return subscribeSwapTokenRefresh(() => refreshTokenRef.current());
  }, []);

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

export const useTokenPair = ({
  account,
  active = true,
}: {
  account: Account;
  active?: boolean;
}) => {
  const swapService = useSwapService();
  const userAddress = account?.address;
  const refreshId = useAtomValue(refreshIdAtom);

  const [quotesListVisible, setQuotesListVisible] = useState(false);

  const {
    initialSelectedChain,
    defaultSelectedFromToken,
    defaultSelectedToToken,
  } = useMemo(
    () => ({
      initialSelectedChain: swapService.getSelectedChain() ?? null,
      defaultSelectedFromToken: swapService.getSelectedFromToken(),
      defaultSelectedToToken: swapService.getSelectedToToken(),
    }),
    [swapService],
  );
  const persistedSwapSelectionStatus: PersistedSwapSelectionStatus = 'ready';
  const [initialChainFromList, setInitialChainFromList] =
    useState<CHAINS_ENUM | null>(null);
  const [chain, setChain] = useState(initialSelectedChain || CHAINS_ENUM.ETH);
  const hasExplicitSwapSelectionRef = useRef(false);
  const hasAppliedInitialChainFallbackRef = useRef(false);

  const markExplicitSwapSelection = useCallback(() => {
    hasExplicitSwapSelectionRef.current = true;
  }, []);

  const handleChain = useCallback(
    (
      c: CHAINS_ENUM,
      options: {
        markExplicitSelection?: boolean;
        persist?: boolean;
      } = {},
    ) => {
      if (options.markExplicitSelection) {
        markExplicitSwapSelection();
      }
      if (options.persist !== false) {
        swapService.setSelectedChain(c);
      }
      setChain(c);
    },
    [markExplicitSwapSelection, swapService],
  );

  const chainInfo = useMemo(
    () => findChainByEnum(chain) || CHAINS[chain],
    [chain],
  );

  const [payAmount, setPayAmount] = useState('');

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

  const currentProvider = useSwapQuoteActiveProvider(active);
  const bestQuoteDex = useSwapQuoteBestDex(active);
  const quoteLoading = useSwapQuoteLoading(active);

  const autoQuoteRefreshPausedRef = useRef(false);
  const reloadTxRefreshPausedRef = useRef(false);

  // The countdown and its timer are owned by a module-level scheduler; this
  // hook only publishes/subscribes the current deadline.
  const quoteRefreshCountdown = useScopedActivityStore(
    active,
    quoteRefreshCountdownStore,
    state => state.countdown,
    Object.is,
    { storeLabel: 'swap-quote-refresh-countdown' },
  );

  const clearExpiredTimer = useCallback(() => {
    clearQuoteRefreshSession();
  }, []);

  const scheduleQuoteRefresh = useCallback((delay: number) => {
    scheduleQuoteRefreshSession({
      delay,
      paused: autoQuoteRefreshPausedRef.current,
      shouldFire: () =>
        shouldScheduleQuotePolling({
          enabled: isSwapQuoteRefreshEnabled(),
          paused: false,
        }),
      onFire: () => {
        requestSwapQuoteRefresh();
      },
    });
  }, []);

  const setAutoQuoteRefreshPaused = useCallback((paused: boolean) => {
    if (autoQuoteRefreshPausedRef.current === paused) {
      return;
    }
    autoQuoteRefreshPausedRef.current = paused;
    if (paused) {
      pauseQuoteRefreshSession();
      return;
    }
    resumeQuoteRefreshSession();
  }, []);

  const setReloadTxRefreshPaused = useCallback((paused: boolean) => {
    reloadTxRefreshPausedRef.current = paused;
  }, []);

  useEffect(() => {
    return () => {
      clearQuoteRefreshSession();
    };
  }, []);

  const setActiveProvider: React.Dispatch<
    React.SetStateAction<QuoteProvider | undefined>
  > = useCallback(p => {
    applySwapQuoteProvider(p);
  }, []);

  useEffect(() => {
    setSwapQuoteRefreshScheduler(() =>
      scheduleQuoteRefresh(SWAP_QUOTE_REFRESH_INTERVAL),
    );
    return () => {
      setSwapQuoteRefreshScheduler(null);
    };
  }, [scheduleQuoteRefresh]);

  const [payToken, setPayToken] = useTokenInfo({
    userAddress,
    chain,
    defaultToken: defaultSelectedFromToken || getChainDefaultToken(chain),
    enabled: active,
  });
  const [receiveToken, _setReceiveToken] = useTokenInfo({
    userAddress,
    chain,
    defaultToken: defaultSelectedToToken,
    enabled: active,
  });

  const {
    lowCreditToken,
    lowCreditVisible,
    setLowCreditToken,
    setLowCreditVisible,
  } = useLowCreditState();

  const setReceiveToken = useCallback(
    (token: TokenItem | undefined) => {
      const isSameToken =
        (!token && !receiveToken) ||
        (!!token &&
          !!receiveToken &&
          token.chain === receiveToken.chain &&
          isSameAddress(token.id, receiveToken.id));
      if (!isSameToken) {
        clearSwapQuoteList();
      }
      _setReceiveToken(token);
      if (token) {
        if (token?.low_credit_score) {
          setLowCreditToken(token);
          setLowCreditVisible(true);
        }
      }
    },
    [_setReceiveToken, receiveToken, setLowCreditToken, setLowCreditVisible],
  );

  const switchChain = useCallback(
    (
      c: CHAINS_ENUM,
      opts?: {
        payTokenId?: string;
        changeTo?: boolean;
        payUseBaseToken?: boolean;
        markExplicitSelection?: boolean;
      },
    ) => {
      handleChain(c, {
        markExplicitSelection: opts?.markExplicitSelection !== false,
      });
      if (c === chain) {
        return;
      }
      if (!opts?.changeTo) {
        const nextTokens = resolveSwapChainTokens({
          chain: c,
          payTokenId: opts?.payTokenId,
          payUseBaseToken: opts?.payUseBaseToken,
        });
        setPayToken(nextTokens.payToken);
        setReceiveToken(nextTokens.receiveToken);
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
    [chain, handleChain, setActiveProvider, setPayToken, setReceiveToken],
  );

  const switchSwapAgain = useCallback(
    (c: CHAINS_ENUM, payTokenId: string, receiveTokenId: string) => {
      handleChain(c, { markExplicitSelection: true });
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
    [handleChain, setActiveProvider, setPayToken, setReceiveToken],
  );

  useAsyncInitializeChainList({
    // NOTICE: now `useTokenPair` is only used for swap page, so we can use `SWAP_SUPPORT_CHAINS` here
    supportChains: SWAP_SUPPORT_CHAINS,
    onChainInitializedAsync: setInitialChainFromList,
    account,
    enabled: active,
  });

  useEffect(() => {
    if (
      !initialChainFromList ||
      !shouldApplyInitialChainFallback({
        persistedSelectionStatus: persistedSwapSelectionStatus,
        persistedSelectedChain: initialSelectedChain,
        hasExplicitSelection: hasExplicitSwapSelectionRef.current,
        hasAppliedFallback: hasAppliedInitialChainFallbackRef.current,
      })
    ) {
      return;
    }

    hasAppliedInitialChainFallbackRef.current = true;
    switchChain(initialChainFromList, { markExplicitSelection: false });
  }, [
    initialChainFromList,
    initialSelectedChain,
    persistedSwapSelectionStatus,
    switchChain,
  ]);

  useEffect(() => {
    if (receiveToken?.id || !payToken?.id) {
      return;
    }

    const defaultToToken = getDefaultSwapToTokenItem(chain);
    if (!defaultToToken || isSameAddress(payToken.id, defaultToToken.id)) {
      return;
    }

    setReceiveToken(defaultToToken);
  }, [chain, payToken?.id, receiveToken?.id, setReceiveToken]);

  useEffect(() => {
    if (persistedSwapSelectionStatus !== 'ready') {
      return;
    }
    swapService.setSelectedFromToken(payToken);
  }, [payToken, persistedSwapSelectionStatus, swapService]);

  useEffect(() => {
    if (persistedSwapSelectionStatus !== 'ready') {
      return;
    }
    swapService.setSelectedToToken(receiveToken);
  }, [persistedSwapSelectionStatus, receiveToken, swapService]);

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
    useSceneActiveAsync(
      async () => {
        if (!userAddress || !isTempoSwapChain) {
          return null;
        }

        return getGasTokenBalance({
          account,
          address: userAddress,
          chainId: chainInfo.id,
        });
      },
      active,
      [account, userAddress, chainInfo.id, refreshId, isTempoSwapChain],
    );

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

  const gasLimit = useMemo(() => getSwapGasReserveGasLimit(chain), [chain]);

  const { value: gasList, loading: isGasMarketLoading } = useSceneActiveAsync(
    () =>
      apiProvider.gasMarketV2(
        {
          chainId: chainInfo.serverId,
        },
        account,
      ),
    active,
    [account, chainInfo.serverId],
  );

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
      setSwapUseSlider(false);
      if (v !== payAmount) {
        clearSwapQuoteList();
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
    },
    [payAmount, payToken, setUseGasPrice],
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

  const autoSlippageValue = getSwapAutoSlippageValue(isStableCoin);

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

  const { feeRate, feeTier } = useMemo(
    () =>
      getRabbyFeeInfo({
        payAmount,
        payTokenPrice: payToken?.price || 0,
        payToken,
        receiveToken,
        isWrapToken,
      }),
    [isWrapToken, payAmount, payToken, receiveToken],
  );

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
    active &&
    !!(
      userAddress &&
      payToken?.id &&
      receiveToken?.id &&
      chain &&
      Number(payAmount) > 0 &&
      feeRate
    ) &&
    canRequestQuote;

  const [autoSuggestSlippage, setAutoSuggestSlippage] =
    useState(autoSlippageValue);

  useEffect(() => {
    if (autoSlippage) {
      setSlippage(autoSlippageValue);
      setAutoSuggestSlippage(autoSlippageValue);
    }
  }, [autoSlippage, autoSlippageValue, setSlippage]);

  const { getAllQuotes, validSlippage } = useQuoteMethods();

  const [isDraggingSlider, setIsDraggingSlider] = useState<boolean>(false);

  // The request itself runs from the module-owned session (debounce, rate limit
  // and in-flight bookkeeping), so its loading lifecycle cannot re-render the
  // swap screen.
  const quoteFetchRunner = useCallback(
    async (currentFetchId: number) => {
      if (!canRunQuoteRequest || isDraggingSlider) {
        markSwapQuoteCycleIdle(currentFetchId);
        return;
      }

      requestSwapTokenRefresh();
      markSwapQuoteRequestLoading();

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
          if (currentFetchId === getSwapQuoteFetchId()) {
            setAutoSuggestSlippage(realSlippage);
          }
        } catch (error) {
          console.log('suggest_slippage error', error);
        }
      }

      try {
        await getAllQuotes({
          userAddress,
          payToken,
          receiveToken,
          slippage: realSlippage || '0.1',
          chain,
          payAmount,
          fee: feeRate,
          setQuote: quote => pushSwapQuoteUpdate(currentFetchId, quote),
          onFinishedQuote: () => undefined,
          inSufficient,
          account,
        });
      } catch (error) {
        console.error('quotesError', error);
      } finally {
        // wait for progress animation finish
        setTimeout(() => {
          finishSwapQuoteCycle(currentFetchId);
        }, 300);
      }
    },
    [
      account,
      autoSlippage,
      canRunQuoteRequest,
      chain,
      feeRate,
      getAllQuotes,
      inSufficient,
      isDraggingSlider,
      payAmount,
      payToken,
      receiveToken,
      slippage,
      userAddress,
    ],
  );

  useEffect(() => {
    setSwapQuoteFetchRunner(quoteFetchRunner);
    return () => {
      setSwapQuoteFetchRunner(null);
    };
  }, [quoteFetchRunner]);

  useEffect(() => {
    if (active) {
      return;
    }
    cancelSwapQuoteRequest();
    cancelSwapQuotePendingWork();
  }, [active]);

  useEffect(
    () => () => {
      cancelSwapQuotePendingWork();
    },
    [],
  );

  // The request key captures every input that invalidates the current quotes.
  // A change to it starts a fresh cycle (visible data is dropped). A refresh tick
  // with an unchanged key is a background refresh: the previous quote list and
  // provider stay visible until the new quotes arrive.
  const quoteRequestKey = [
    canRunQuoteRequest ? '1' : '0',
    canRequestQuote ? '1' : '0',
    userAddress || '',
    payToken?.id || '',
    receiveToken?.id || '',
    chain,
    feeRate || '',
    payAmount,
    isDraggingSlider ? '1' : '0',
    slippage,
    autoSlippage ? '1' : '0',
  ].join('|');
  const quoteRequestKeyRef = useRef<string | null>(null);

  const runQuoteCycle = useCallback(() => {
    if (!active) {
      quoteRequestKeyRef.current = null;
      resetSwapQuoteListOnInactive();
      return;
    }
    const isBackgroundRefresh =
      quoteRequestKeyRef.current === quoteRequestKey &&
      canRunQuoteRequest &&
      !isDraggingSlider;
    quoteRequestKeyRef.current = quoteRequestKey;

    const requestId = beginSwapQuoteCycle({
      keepVisibleData: isBackgroundRefresh,
      willRequest: canRunQuoteRequest,
    });
    if (canRunQuoteRequest) {
      scheduleSwapQuoteRequest(requestId);
    } else {
      markSwapQuoteCycleIdle(requestId);
    }
  }, [active, quoteRequestKey, canRunQuoteRequest, isDraggingSlider]);

  // The 20s timer is module-owned; it starts a cycle directly instead of
  // bumping a React atom, so the periodic tick itself renders nothing.
  useEffect(() => {
    setSwapQuoteCycleRunner(runQuoteCycle);
    return () => {
      setSwapQuoteCycleRunner(null);
    };
  }, [runQuoteCycle]);

  useLayoutEffect(() => {
    runQuoteCycle();
    // `refreshId` is the explicit refresh signal (quote list refresh button).
  }, [runQuoteCycle, refreshId]);

  const canUpdateActiveProvider = canRunQuoteRequest;

  // The quote list lives outside React; the selection recompute runs inside the
  // session module on every batch and whenever these inputs change.
  useEffect(() => {
    setSwapQuoteSelectionContext({
      canUpdateActiveProvider,
      payToken,
      receiveToken,
      payAmount,
      inSufficient,
    });
  }, [
    canUpdateActiveProvider,
    payToken,
    receiveToken,
    payAmount,
    inSufficient,
  ]);

  const {
    value: slippageValidInfo,
    // error: slippageValidError,
    loading: slippageValidLoading,
  } = useSceneActiveAsync(
    async () => {
      if (chain && Number(slippage) && payToken?.id && receiveToken?.id) {
        return validSlippage({
          chain,
          slippage,
          payTokenId: payToken?.id,
          receiveTokenId: receiveToken?.id,
        });
      }
    },
    active,
    [slippage, chain, payToken?.id, receiveToken?.id, refreshId],
  );

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
      clearSwapQuoteSession();
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

  const hasReportedSwapEntryRef = useRef(false);
  useEffect(() => {
    if (!active || hasReportedSwapEntryRef.current) {
      return;
    }
    hasReportedSwapEntryRef.current = true;
  }, [active]);

  /* slider */
  const [slider, setSlider] = useState<number>(0);

  const [swapUseSlider, setSwapUseSlider] = useState<boolean>(false);

  const handleSlider100 = useCallback(() => {
    if (!payToken) {
      return;
    }

    setUseGasPrice(false);
    const fullAmount = tokenAmountBn(payToken);
    let nextPayAmount = fullAmount.toString(10);
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
      nextPayAmount = val.lt(0) ? fullAmount.toString(10) : val.toString(10);
    }

    if (nextPayAmount !== payAmount) {
      clearSwapQuoteList();
      setPayAmount(nextPayAmount);
    }
  }, [
    payAmount,
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
        const nextPayAmount = isTooSmall
          ? newAmountBn.toString(10)
          : new BigNumber(newAmountBn.toFixed(4, 1)).toString(10);
        if (nextPayAmount !== payAmount) {
          clearSwapQuoteList();
          setPayAmount(nextPayAmount);
        }
      }
    },
    [handleSlider100, payAmount, payToken],
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
      if (!active) {
        return;
      }
      const refresh = () => {
        if (
          autoQuoteRefreshPausedRef.current ||
          reloadTxRefreshPausedRef.current ||
          isGasAccountDepositFlowActive()
        ) {
          return;
        }
        requestSwapTokenRefresh();
      };
      eventBus.addListener(EVENTS.RELOAD_TX, refresh);
      return () => {
        eventBus.removeListener(EVENTS.RELOAD_TX, refresh);
      };
    }, [active]),
  );

  const onSetAutoSlippage = useCallback(() => {
    setAutoSlippage(true);
  }, [setAutoSlippage]);

  useAutoSlippageEffect({
    chainServerId: findChainByEnum(chain)?.serverId || '',
    fromTokenId: payToken?.id || '',
    toTokenId: receiveToken?.id || '',
    onSetAutoSlippage,
    enabled: active,
  });

  useClearMiniGasStateEffect({
    chainServerId: findChainByEnum(chain)?.serverId || '',
    enabled: active,
  });

  return {
    bestQuoteDex,
    chain,
    markExplicitSwapSelection,
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
    feeTier,
    isSlippageHigh,
    isSlippageLow,

    //quote
    openQuotesList,
    closeQuotesList,
    quotesListVisible,
    quoteLoading,
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

    lowCreditToken,
    lowCreditVisible,
    setLowCreditToken,
    setLowCreditVisible,

    clearExpiredTimer,
    setAutoQuoteRefreshPaused,
    setReloadTxRefreshPaused,
    quoteRefreshCountdown,

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
