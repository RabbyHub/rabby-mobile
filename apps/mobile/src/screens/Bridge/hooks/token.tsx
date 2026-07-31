import { CHAINS, CHAINS_ENUM } from '@debank/common';
import { ETH_USDT_CONTRACT } from '@/constant/swap';
import { formatTokenAmountInput, formatUsdValue } from '@/utils/number';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { findChain, findChainByEnum, findChainByServerID } from '@/utils/chain';
import { BridgeQuote, TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import useAsyncFn from 'react-use/lib/useAsyncFn';
import useDebounce from 'react-use/lib/useDebounce';
import { stats } from '@/utils/stats';
import { openapi } from '@/core/request';
import { useRefreshId, useSetQuoteVisible, useSetRefreshId } from './context';
import { getChainDefaultToken } from '@/constant/swap';
import { tokenAmountBn } from '@/screens/Swap/utils';
import {
  bridgeQuoteScore,
  getBestBridgeQuote,
  isSameBridgeQuote,
} from '../utils/bridgeQuote';
import BigNumber from 'bignumber.js';
import { useBridgeSlippage } from './slippage';
import { isNaN } from 'lodash';
import { useLoadMatteredChainBalances } from '@/hooks/accountChainBalance';
import { useAggregatorsList, useBridgeSupportedChains } from './atom';
import { getERC20Allowance } from '@/core/apis/provider';
import { apiProvider } from '@/core/apis';
import { getGasTokenBalance } from '@/core/apis/transactions';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { RootNames } from '@/constant/layout';
import { GetNestedScreenRouteProp } from '@/navigation-type';
import { useSwapBridgeSlider } from '@/screens/Swap/hooks/slider';
import { eventBus, EVENTS } from '@/utils/events';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { useClearMiniGasStateEffect } from '@/hooks/miniSignGasStore';
import { atom, useAtomValue, useSetAtom } from 'jotai';
import { getQuotePollingResumeDelay } from '@/utils/quotePolling';
import { isTokenMarketClosed } from '@/utils/token';
import { isGasAccountDepositFlowActive } from '@/screens/GasAccount/utils/depositFlowRuntime';
import { getQuoteList as getBridgeQuoteList } from '@rabby-wallet/rabby-bridge';
import { convert18RawToTokenRaw, isTempoChain } from '@/utils/tempo';
import type { SelectedBridgeQuote } from '../types';
import { createBridgeInitializationController } from '../bridgeInitialization';
import {
  getBridgeAllowanceRequestKey,
  getOrCreateBridgeAllowanceRequest,
  mergeBridgeQuoteBatch,
} from '../utils/quoteResultBatch';
import { useSceneActiveAsync } from '@/screens/SwapBridge/hooks/useSceneActiveAsync';

export const enableInsufficientQuote = true;
const BRIDGE_QUOTE_REFRESH_INTERVAL = 1000 * 30;
const EARLY_QUOTE_DISPLAY_MIN_TO_FROM_USD_RATIO = 0.03;

export const tokenPriceImpact = (
  fromToken?: TokenItem,
  toToken?: TokenItem,
  fromAmount?: string | number,
  toAmount?: string | number,
) => {
  const notReady = [fromToken, toToken, fromAmount, toAmount].some(e =>
    isNaN(e),
  );

  if (notReady) {
    return;
  }

  const fromUsdBn = new BigNumber(fromAmount || 0).times(fromToken?.price || 0);
  const toUsdBn = new BigNumber(toAmount || 0).times(toToken?.price || 0);

  const cut = toUsdBn.minus(fromUsdBn).div(fromUsdBn).times(100);

  return {
    showLoss: cut.lte(-5),
    lossUsd: formatUsdValue(toUsdBn.minus(fromUsdBn).abs().toString()),
    diff: cut.abs().toFixed(2),
    fromUsd: formatUsdValue(fromUsdBn.toString(10)),
    toUsd: formatUsdValue(toUsdBn.toString(10)),
  };
};

const getTokenUsdValue = ({
  token,
  amount,
}: {
  token?: TokenItem;
  amount: string;
}) => new BigNumber(amount || 0).times(token?.price || 0);

const getBridgeQuoteToTokenUsdValue = ({
  quote,
  toToken,
}: {
  quote: SelectedBridgeQuote;
  toToken: TokenItem;
}) => new BigNumber(quote.to_token_amount || 0).times(toToken.price || 0);

const canDisplayBridgeQuoteBeforeAllQuotesLoaded = ({
  quote,
  fromToken,
  toToken,
  amount,
}: {
  quote: SelectedBridgeQuote;
  fromToken?: TokenItem;
  toToken: TokenItem;
  amount: string;
}) => {
  const fromUsdValue = getTokenUsdValue({
    token: fromToken,
    amount,
  });

  if (!fromUsdValue.gt(0)) {
    return true;
  }

  return getBridgeQuoteToTokenUsdValue({ quote, toToken }).gte(
    fromUsdValue.times(EARLY_QUOTE_DISPLAY_MIN_TO_FROM_USD_RATIO),
  );
};

const tokenRefreshIdAtom = atom(0);
const useTokenRefreshId = () => useAtomValue(tokenRefreshIdAtom);
const useSetTokenRefreshId = () => useSetAtom(tokenRefreshIdAtom);

const useToken = (type: 'from' | 'to', active: boolean) => {
  const refreshId = useTokenRefreshId();

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const userAddress = currentAccount?.address;

  // 使用 useRef 保持 chain 状态，避免账户切换时重置
  const chainRef = useRef<CHAINS_ENUM | undefined>(undefined);
  const [chain, setChain] = useState<CHAINS_ENUM | undefined>(chainRef.current);

  // 标记是否已经初始化过 chain，避免重复初始化
  const isInitializedRef = useRef(false);

  const [token, setToken] = useState<TokenItem & { tokenId?: string }>();

  // 同步 chain 状态到 ref，保持状态持久化
  useEffect(() => {
    if (chain) {
      chainRef.current = chain;
    }
  }, [chain]);

  const switchChain: (changeChain?: CHAINS_ENUM, resetToken?: boolean) => void =
    useCallback(
      (changeChain?: CHAINS_ENUM, resetToken = true) => {
        // 同时更新 state 和 ref
        setChain(changeChain);
        if (changeChain) {
          chainRef.current = changeChain;
          isInitializedRef.current = true; // 标记已初始化
        }
        if (resetToken) {
          if (type === 'from') {
            setToken(
              changeChain ? getChainDefaultToken(changeChain) : undefined,
            );
          } else {
            setToken(undefined);
          }
        }
      },
      [type],
    );

  const { value, loading, error } = useSceneActiveAsync(
    async () => {
      if (userAddress && token?.id && chain) {
        const data = await openapi.getToken(
          userAddress,
          findChainByEnum(chain)!.serverId,
          token.id,
        );
        return { ...data, tokenId: token.id };
      }
    },
    active,
    [refreshId, userAddress, token?.id, chain],
  );

  useDebounce(
    () => {
      if (active && value && !error && !loading) {
        setToken(value);
      }
    },
    300,
    [active, value, error, loading],
  );

  return [chain, token, setToken, switchChain] as const;
};

export const useBridge = (
  isForMultipleAddress?: boolean,
  { active = true }: { active?: boolean } = {},
) => {
  const setTokenRefreshId = useSetTokenRefreshId();

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  const userAddress = currentAccount?.address;
  const refreshId = useRefreshId();

  const setRefreshId = useSetRefreshId();

  const [fromChain, fromToken, setFromToken, switchFromChain] = useToken(
    'from',
    active,
  );
  const [toChain, toToken, setToToken, switchToChain] = useToken('to', active);
  const latestFromChainRef = useRef(fromChain);
  latestFromChainRef.current = fromChain;

  // 标记是否已经初始化过 fromChain，避免重复初始化
  const isFromChainInitializedRef = useRef(false);
  // 标记是否已经初始化过 toChain，避免重复初始化
  const isToChainInitializedRef = useRef(false);

  // 包装 switchFromChain，更新初始化标记
  const wrappedSwitchFromChain = useCallback(
    (chain?: CHAINS_ENUM, resetToken?: boolean) => {
      latestFromChainRef.current = chain;
      if (chain) {
        isFromChainInitializedRef.current = true;
      }
      switchFromChain(chain, resetToken);
    },
    [switchFromChain],
  );

  // 包装 switchToChain，更新初始化标记
  const wrappedSwitchToChain = useCallback(
    (chain?: CHAINS_ENUM, resetToken?: boolean) => {
      if (chain) {
        isToChainInitializedRef.current = true;
      }
      switchToChain(chain, resetToken);
    },
    [switchToChain],
  );

  useEffect(() => {
    if (active && !toChain && toToken) {
      setToToken(undefined);
    }
  }, [active, setToToken, toChain, toToken]);

  const [amount, setAmount] = useState('');

  const slippageObj = useBridgeSlippage();

  const [recommendFromToken, setRecommendFromToken] = useState<TokenItem>();

  const [selectedBridgeQuote, setOriSelectedBridgeQuote] = useState<
    SelectedBridgeQuote | undefined
  >();

  const expiredTimer = useRef<NodeJS.Timeout>(undefined);
  const autoQuoteRefreshDeadlineRef = useRef<number | null>(null);
  const autoQuoteRefreshPausedRef = useRef(false);
  const reloadTxRefreshPausedRef = useRef(false);

  const inSufficient = useMemo(
    () =>
      fromToken
        ? tokenAmountBn(fromToken).lt(amount)
        : new BigNumber(0).lt(amount),
    [fromToken, amount],
  );

  const inSufficientCanGetQuote = useMemo(
    () => (enableInsufficientQuote ? true : !inSufficient),
    [inSufficient],
  );
  const quoteBlockedByClosedMarket = useMemo(
    () => isTokenMarketClosed(fromToken) || isTokenMarketClosed(toToken),
    [fromToken, toToken],
  );
  const canRequestQuote = useMemo(
    () => active && inSufficientCanGetQuote && !quoteBlockedByClosedMarket,
    [active, inSufficientCanGetQuote, quoteBlockedByClosedMarket],
  );

  const { value: isSameToken, loading: isSameTokenLoading } =
    useSceneActiveAsync(
      async () => {
        if (fromChain && fromToken?.id && toChain && toToken?.id) {
          try {
            const data = await openapi.isSameBridgeToken({
              from_chain_id: findChainByEnum(fromChain)!.serverId,
              from_token_id: fromToken?.id,
              to_chain_id: findChainByEnum(toChain)!.serverId,
              to_token_id: toToken?.id,
            });
            return data?.every(e => e.is_same);
          } catch (error) {
            return false;
          }
        }
        return false;
      },
      active,
      [fromChain, fromToken?.id, toChain, toToken?.id],
    );

  useEffect(() => {
    if (active && !isSameTokenLoading && slippageObj.autoSlippage) {
      slippageObj.setSlippage(isSameToken ? '0.5' : '1');
    }
  }, [active, slippageObj, isSameToken, isSameTokenLoading]);

  const { fetchOrderedChainList } = useLoadMatteredChainBalances({
    account: currentAccount!,
  });
  const supportedChains = useBridgeSupportedChains();
  // the most worth chain is the first
  // useAsyncInitializeChainList({
  //   supportChains: supportedChains,
  //   onChainInitializedAsync: firstEnum => {
  //     switchFromChain(firstEnum);
  //     getRecommendToChain(firstEnum);
  //   },
  // });

  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'TransactionNavigatorParamList',
        typeof RootNames.SwapBridge | typeof RootNames.MultiSwapBridge
      >
    >();
  const navState = route.params;

  useEffect(() => {
    if (
      !active ||
      !toChain ||
      toToken?.id ||
      navState?.toTokenId ||
      (navState?.toChainEnum && navState.toChainEnum !== toChain)
    ) {
      return;
    }

    setToToken(getChainDefaultToken(toChain));
  }, [
    active,
    navState?.toChainEnum,
    navState?.toTokenId,
    setToToken,
    toChain,
    toToken?.id,
  ]);

  const switchToken = useCallback(() => {
    wrappedSwitchFromChain(toChain, false);
    wrappedSwitchToChain(fromChain, false);
    setFromToken(toToken);
    setToToken(fromToken);
  }, [
    setFromToken,
    toToken,
    setToToken,
    fromToken,
    wrappedSwitchFromChain,
    toChain,
    wrappedSwitchToChain,
    fromChain,
  ]);

  const [quoteList, setQuotesList] = useState<SelectedBridgeQuote[]>([]);

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
    setRefreshId(e => e + 1);
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

  const setSelectedBridgeQuote = useCallback(
    (quote?: SelectedBridgeQuote) => {
      if (!quote?.manualClick) {
        clearExpiredTimer();
      }

      if (!quote?.manualClick && quote) {
        scheduleQuoteRefresh(BRIDGE_QUOTE_REFRESH_INTERVAL);
      }
      setOriSelectedBridgeQuote(quote);
    },
    [clearExpiredTimer, scheduleQuoteRefresh],
  );

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

  // const aggregatorsList = useBridgeSupportedChains(s => s.bridge.aggregatorsList || []);
  const aggregatorsList = useAggregatorsList();

  const [bestQuoteId, setBestQuoteId] = useState<
    | {
        bridgeId: string;
        aggregatorId: string;
      }
    | undefined
  >(undefined);

  const openQuote = useSetQuoteVisible();

  const openQuotesList = useCallback(() => {
    openQuote(true);
  }, [openQuote]);

  const showLoss = useMemo(() => {
    if (selectedBridgeQuote) {
      return !!tokenPriceImpact(
        fromToken,
        toToken,
        amount,
        selectedBridgeQuote?.to_token_amount,
      )?.showLoss;
    }
    return false;
  }, [fromToken, toToken, amount, selectedBridgeQuote]);

  const chainInfo = useMemo(
    () => findChainByEnum(fromChain) || CHAINS[fromChain || 'ETH'],
    [fromChain],
  );

  const isTempoBridgeChain = useMemo(
    () => isTempoChain(chainInfo.serverId),
    [chainInfo.serverId],
  );

  const { value: tempoGasTokenInfo, loading: isTempoGasTokenLoading } =
    useSceneActiveAsync(
      async () => {
        if (!currentAccount?.address || !isTempoBridgeChain) {
          return null;
        }

        return getGasTokenBalance({
          account: currentAccount,
          address: currentAccount.address,
          chainId: chainInfo.id,
        });
      },
      active,
      [
        currentAccount,
        currentAccount?.address,
        chainInfo.id,
        isTempoBridgeChain,
      ],
    );

  const { value: gasList, loading: isGasMarketLoading } = useSceneActiveAsync(
    () =>
      apiProvider.gasMarketV2(
        {
          chainId: chainInfo.serverId,
        },
        currentAccount!,
      ),
    active,
    [chainInfo.serverId, currentAccount],
  );

  const [passGasPrice, setUseGasPrice] = useState(false);
  const isMaxRef = useRef(false);
  const [clickMaxBtnCount, setClickMaxBtnCount] = useState(0);

  const normalGasPrice = useMemo(
    () => gasList?.find(e => e.level === 'normal')?.price,
    [gasList],
  );

  const nativeTokenDecimals = useMemo(
    () => findChain({ enum: fromChain })?.nativeTokenDecimals || 1e18,
    [fromChain],
  );

  const gasLimit = useMemo(
    () => (fromChain === CHAINS_ENUM.ETH ? 1000000 : 2000000),
    [fromChain],
  );

  const payTokenIsNativeToken = useMemo(() => {
    if (fromToken) {
      return isSameAddress(fromToken.id, chainInfo.nativeTokenAddress);
    }
    return false;
  }, [chainInfo?.nativeTokenAddress, fromToken]);

  const fromTokenIsTempoFeeToken = useMemo(() => {
    if (
      !isTempoBridgeChain ||
      !fromToken?.id ||
      !tempoGasTokenInfo?.token.tokenId
    ) {
      return false;
    }

    return isSameAddress(fromToken.id, tempoGasTokenInfo.token.tokenId);
  }, [fromToken?.id, isTempoBridgeChain, tempoGasTokenInfo?.token.tokenId]);

  const fromTokenIsGasToken = useMemo(
    () => payTokenIsNativeToken || fromTokenIsTempoFeeToken,
    [payTokenIsNativeToken, fromTokenIsTempoFeeToken],
  );

  const gasTokenDecimals = useMemo(() => {
    if (payTokenIsNativeToken) {
      return nativeTokenDecimals;
    }

    if (fromTokenIsTempoFeeToken) {
      return tempoGasTokenInfo?.token.decimals || fromToken?.decimals || 18;
    }

    return undefined;
  }, [
    fromToken?.decimals,
    fromTokenIsTempoFeeToken,
    nativeTokenDecimals,
    payTokenIsNativeToken,
    tempoGasTokenInfo?.token.decimals,
  ]);

  const handleSlider100 = useCallback(() => {
    if (!fromToken) {
      return;
    }

    setUseGasPrice(false);
    const fullAmount = tokenAmountBn(fromToken);
    if (
      fromTokenIsGasToken &&
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
      setAmount(val.lt(0) ? fullAmount.toString(10) : val.toString(10));
      return;
    }

    setAmount(fullAmount.toString(10));
  }, [
    fromToken,
    fromTokenIsGasToken,
    gasLimit,
    gasTokenDecimals,
    normalGasPrice,
  ]);

  const {
    onChangeSlider,
    slider,
    setSlider,
    useSlider,
    setUseSlider,
    isDraggingSlider,
    setIsDraggingSlider,
  } = useSwapBridgeSlider({
    setAmount,
    fromToken,
    handleSlider100,
  });

  const handleAmountChange = useCallback(
    (e: string) => {
      const v = formatTokenAmountInput(e, fromToken?.decimals);
      if (!/^\d*(\.\d*)?$/.test(v)) {
        return;
      }
      if (fromToken) {
        const slider = v
          ? Number(
              new BigNumber(v || 0)
                .div(fromToken?.amount ? tokenAmountBn(fromToken) : 1)
                .times(100)
                .toFixed(0),
            )
          : 0;
        setSlider(slider < 0 ? 0 : slider > 100 ? 100 : slider);
        if (!fromToken?.amount) {
          setSlider(0);
        }
      }
      setUseGasPrice(false);
      setUseSlider(false);
      setAmount(v);
      if (Number(v) > 0) {
        setPending(true);
      }
    },
    [fromToken, setSlider, setUseSlider],
  );

  const handleMax = useCallback(() => {
    setUseGasPrice(false);

    if (fromToken) {
      isMaxRef.current = true;
      setUseSlider(true);
      handleSlider100();
      setSlider(100);
      setClickMaxBtnCount(e => e + 1);
    }
  }, [fromToken, handleSlider100, setSlider, setUseSlider]);

  useEffect(() => {
    if (
      slider === 100 &&
      useSlider &&
      fromToken?.amount &&
      !isGasMarketLoading &&
      (!isTempoBridgeChain || !isTempoGasTokenLoading)
    ) {
      handleSlider100();
    }
  }, [
    slider,
    useSlider,
    fromToken?.amount,
    isGasMarketLoading,
    isTempoBridgeChain,
    isTempoGasTokenLoading,
    handleSlider100,
  ]);

  const fillRecommendFromToken = useCallback(() => {
    if (recommendFromToken) {
      const targetChain = findChainByServerID(recommendFromToken?.chain);
      if (targetChain) {
        wrappedSwitchFromChain(targetChain.enum, false);
        setFromToken(recommendFromToken);
        setAmount('');
        setSlider(0);
        setUseSlider(false);
        setIsDraggingSlider(false);
      }
    }
  }, [
    recommendFromToken,
    wrappedSwitchFromChain,
    setFromToken,
    setSlider,
    setUseSlider,
    setIsDraggingSlider,
  ]);

  const fetchIdRef = useRef(0);
  const pendingQuoteUpdatesRef = useRef(new Map<string, SelectedBridgeQuote>());
  const quoteFlushFrameRef = useRef<number | null>(null);

  const cancelPendingQuoteFlush = useCallback(() => {
    if (quoteFlushFrameRef.current !== null) {
      cancelAnimationFrame(quoteFlushFrameRef.current);
      quoteFlushFrameRef.current = null;
    }
    pendingQuoteUpdatesRef.current.clear();
  }, []);

  const flushPendingQuoteUpdates = useCallback((id: number) => {
    if (quoteFlushFrameRef.current !== null) {
      cancelAnimationFrame(quoteFlushFrameRef.current);
      quoteFlushFrameRef.current = null;
    }
    if (id !== fetchIdRef.current) {
      pendingQuoteUpdatesRef.current.clear();
      return;
    }

    const updates = Array.from(pendingQuoteUpdatesRef.current.values());
    pendingQuoteUpdatesRef.current.clear();
    if (updates.length) {
      setQuotesList(current => mergeBridgeQuoteBatch(current, updates));
    }
  }, []);

  const scheduleQuoteUpdates = useCallback(
    (id: number, quotes: SelectedBridgeQuote[]) => {
      if (!quotes.length || id !== fetchIdRef.current) {
        return;
      }

      quotes.forEach(quote => {
        pendingQuoteUpdatesRef.current.set(
          `${quote.aggregator.id}:${quote.bridge.id}`,
          quote,
        );
      });
      if (quoteFlushFrameRef.current === null) {
        quoteFlushFrameRef.current = requestAnimationFrame(() => {
          quoteFlushFrameRef.current = null;
          flushPendingQuoteUpdates(id);
        });
      }
    },
    [flushPendingQuoteUpdates],
  );

  const [quoteRequestId, setQuoteRequestId] = useState(0);
  const [{ loading: quoteLoading, error: quotesError }, getQuoteList] =
    useAsyncFn(async () => {
      if (!active) {
        return;
      }
      fetchIdRef.current += 1;
      const currentFetchId = fetchIdRef.current;
      setQuoteRequestId(currentFetchId);

      if (
        canRequestQuote &&
        userAddress &&
        fromToken?.id &&
        toToken?.id &&
        toToken &&
        fromChain &&
        toChain &&
        Number(amount) > 0 &&
        aggregatorsList.length > 0 &&
        !isDraggingSlider
      ) {
        setTokenRefreshId(e => e + 1);

        setQuotesList(e => e?.map(e => ({ ...e, loading: true })));

        const originData: Omit<BridgeQuote, 'tx'>[] = [];
        const allowanceRequestCache = new Map<string, Promise<string>>();

        const getQuoteWithApproval = async (
          quote: Omit<BridgeQuote, 'tx'>,
        ): Promise<SelectedBridgeQuote | undefined> => {
          if (currentFetchId !== fetchIdRef.current) {
            return;
          }

          let tokenApproved = false;
          let allowance = '0';
          const fromFindChain = findChain({ serverId: fromToken?.chain });
          if (fromToken?.id === fromFindChain?.nativeTokenAddress) {
            tokenApproved = true;
          } else if (!quote.approve_contract_id) {
            tokenApproved = true;
          } else {
            const allowanceKey = getBridgeAllowanceRequestKey({
              chainId: fromToken.chain,
              tokenId: fromToken.id,
              spender: quote.approve_contract_id,
              account: currentAccount.address,
            });
            const allowanceRequest = getOrCreateBridgeAllowanceRequest(
              allowanceRequestCache,
              allowanceKey,
              () =>
                getERC20Allowance(
                  fromToken.chain,
                  fromToken.id,
                  quote.approve_contract_id!,
                  currentAccount.address,
                  currentAccount,
                ),
            );
            allowance = await allowanceRequest;
            tokenApproved = new BigNumber(allowance).gte(
              new BigNumber(amount).times(10 ** fromToken.decimals),
            );
          }

          let shouldTwoStepApprove = false;
          if (
            fromFindChain?.enum === CHAINS_ENUM.ETH &&
            isSameAddress(fromToken.id, ETH_USDT_CONTRACT) &&
            Number(allowance) !== 0 &&
            !tokenApproved
          ) {
            shouldTwoStepApprove = true;
          }

          return {
            ...quote,
            loading: false,
            shouldTwoStepApprove,
            shouldApproveToken: !tokenApproved,
          };
        };

        const getQUoteV2 = async (alternativeToken?: TokenItem) =>
          await Promise.allSettled(
            aggregatorsList.map(async bridgeAggregator => {
              const data = await getBridgeQuoteList(
                bridgeAggregator.id,
                {
                  userAddress,
                  fromChainId: alternativeToken?.chain || fromToken.chain,
                  fromTokenId: alternativeToken?.id || fromToken.id,
                  fromTokenRawAmount: alternativeToken
                    ? new BigNumber(amount)
                        .times(fromToken.price)
                        .div(alternativeToken.price)
                        .times(10 ** alternativeToken.decimals)
                        .toFixed(0, 1)
                        .toString()
                    : new BigNumber(amount)
                        .times(10 ** fromToken.decimals)
                        .toFixed(0, 1)
                        .toString(),
                  toChainId: toToken.chain,
                  toTokenId: toToken.id,
                  slippage: new BigNumber(slippageObj.slippageState)
                    .div(100)
                    .toString(10),
                },
                openapi,
              ).catch(e => {
                if (
                  currentFetchId === fetchIdRef.current &&
                  !alternativeToken
                ) {
                  stats.report('bridgeQuoteResult', {
                    aggregatorIds: bridgeAggregator.id,
                    fromChainId: fromToken.chain,
                    fromTokenId: fromToken.id,
                    toTokenId: toToken.id,
                    toChainId: toToken.chain,
                    status: 'fail',
                  });
                }
              });

              if (alternativeToken) {
                if (
                  data &&
                  data?.length &&
                  currentFetchId === fetchIdRef.current
                ) {
                  setRecommendFromToken(alternativeToken);
                  return;
                }
              }
              if (data && currentFetchId === fetchIdRef.current) {
                originData.push(...data);
              }
              if (currentFetchId === fetchIdRef.current) {
                stats.report('bridgeQuoteResult', {
                  aggregatorIds: bridgeAggregator.id,
                  fromChainId: fromToken.chain,
                  fromTokenId: fromToken.id,
                  toTokenId: toToken.id,
                  toChainId: toToken.chain,
                  status: data?.length ? 'success' : 'none',
                });
              }

              const validData =
                data?.filter(
                  quote =>
                    !!quote?.bridge &&
                    !!quote?.bridge?.id &&
                    !!quote?.bridge?.logo_url &&
                    !!quote.bridge.name,
                ) || [];

              if (validData.length && currentFetchId === fetchIdRef.current) {
                scheduleQuoteUpdates(
                  currentFetchId,
                  validData.map(quote => ({ ...quote, loading: true })),
                );

                await Promise.allSettled(
                  validData.map(async quote => {
                    const nextQuote = await getQuoteWithApproval(quote);
                    if (
                      nextQuote &&
                      currentFetchId === fetchIdRef.current &&
                      Number(amount) > 0
                    ) {
                      scheduleQuoteUpdates(currentFetchId, [nextQuote]);
                    }
                  }),
                );
              }

              return data;
            }),
          );

        await getQUoteV2();

        const data = originData?.filter(
          quote =>
            !!quote?.bridge &&
            !!quote?.bridge?.id &&
            !!quote?.bridge?.logo_url &&
            !!quote.bridge.name,
        );

        if (currentFetchId === fetchIdRef.current) {
          flushPendingQuoteUpdates(currentFetchId);
          setPending(false);

          if (data.length < 1) {
            try {
              const res = await openapi.getRecommendFromToken({
                user_addr: userAddress,
                from_chain_id: fromToken.chain,
                from_token_id: fromToken.id,
                from_token_amount: new BigNumber(amount)
                  .times(10 ** fromToken.decimals)
                  .toFixed(0, 1)
                  .toString(),
                to_chain_id: toToken.chain,
                to_token_id: toToken.id,
              });
              if (res?.token_list?.[0]) {
                await getQUoteV2(res?.token_list?.[0]);
              } else {
                setRecommendFromToken(undefined);
              }
            } catch (error) {
              setRecommendFromToken(undefined);
            }

            setSelectedBridgeQuote(undefined);
          }

          stats.report('bridgeQuoteResult', {
            aggregatorIds: aggregatorsList.map(e => e.id).join(','),
            fromChainId: fromToken.chain,
            fromTokenId: fromToken.id,
            toTokenId: toToken.id,
            toChainId: toToken.chain,
            status: data ? (data?.length === 0 ? 'none' : 'success') : 'fail',
          });
        }
      }
    }, [
      active,
      canRequestQuote,
      aggregatorsList,
      refreshId,
      userAddress,
      fromToken?.id,
      toToken?.id,
      fromChain,
      toChain,
      amount,
      slippageObj.slippage,
      isDraggingSlider,
      flushPendingQuoteUpdates,
      scheduleQuoteUpdates,
    ]);

  const [pending, setPending] = useState(false);

  useLayoutEffect(() => {
    if (!active) {
      return;
    }
    fetchIdRef.current += 1;
    cancelPendingQuoteFlush();
    setQuoteRequestId(fetchIdRef.current);
    setQuotesList([]);
    setRecommendFromToken(undefined);
    setSelectedBridgeQuote(undefined);
    setPending(false);
  }, [
    active,
    userAddress,
    fromToken?.id,
    toToken?.id,
    fromChain,
    toChain,
    amount,
    slippageObj.slippage,
    cancelPendingQuoteFlush,
    setSelectedBridgeQuote,
  ]);

  useEffect(() => {
    if (
      canRequestQuote &&
      userAddress &&
      fromToken?.id &&
      toToken?.id &&
      fromChain &&
      toChain &&
      Number(amount) > 0 &&
      aggregatorsList.length > 0
    ) {
      setPending(true);
    } else {
      setPending(false);
    }
  }, [
    canRequestQuote,
    userAddress,
    fromToken?.id,
    toToken?.id,
    fromChain,
    toChain,
    amount,
    aggregatorsList.length,
    refreshId,
  ]);

  const [, cancelDebounce] = useDebounce(
    () => {
      getQuoteList();
    },
    300,
    [getQuoteList],
  );

  useEffect(() => {
    if (active) {
      return;
    }
    fetchIdRef.current += 1;
    cancelPendingQuoteFlush();
    cancelDebounce();
  }, [active, cancelDebounce, cancelPendingQuoteFlush]);

  useEffect(
    () => () => {
      cancelPendingQuoteFlush();
    },
    [cancelPendingQuoteFlush],
  );

  const hasPendingBridgeQuote = pending || quoteLoading;
  const bridgeQuoteRequestFinished = !hasPendingBridgeQuote;

  useEffect(() => {
    if (!active || !toToken?.id) {
      return;
    }

    const selectableQuoteList = bridgeQuoteRequestFinished
      ? quoteList
      : quoteList.filter(quote =>
          canDisplayBridgeQuoteBeforeAllQuotesLoaded({
            quote,
            fromToken,
            toToken,
            amount,
          }),
        );

    const best = getBestBridgeQuote(selectableQuoteList, toToken);
    if (!best) {
      return;
    }

    const bestQuote = best.quote;
    if (bestQuote?.bridge_id && bestQuote?.aggregator?.id) {
      setBestQuoteId({
        bridgeId: bestQuote.bridge_id,
        aggregatorId: bestQuote.aggregator.id,
      });

      const selectedQuoteLoaded = quoteList.some(
        quote =>
          !quote.loading && isSameBridgeQuote(quote, selectedBridgeQuote),
      );
      if (selectedQuoteLoaded && selectedBridgeQuote?.manualClick) {
        const canDisplaySelectedQuote =
          bridgeQuoteRequestFinished ||
          canDisplayBridgeQuoteBeforeAllQuotesLoaded({
            quote: selectedBridgeQuote,
            fromToken,
            toToken,
            amount,
          });

        if (canDisplaySelectedQuote) {
          return;
        }
      }

      const shouldUpdateSelectedQuote =
        !selectedBridgeQuote ||
        !selectedQuoteLoaded ||
        best.score.gt(bridgeQuoteScore(selectedBridgeQuote, toToken));

      if (shouldUpdateSelectedQuote) {
        setSelectedBridgeQuote(bestQuote);
      }
    }
    // toToken price is needed by the early-display USD guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    active,
    quoteList,
    bridgeQuoteRequestFinished,
    fromToken,
    amount,
    toToken?.id,
    toToken?.price,
    selectedBridgeQuote,
    setSelectedBridgeQuote,
  ]);

  useEffect(() => {
    if (quotesError) {
      console.error('quotesError', quotesError);
    }
  }, [quotesError]);

  const initializationControllerRef = useRef(
    createBridgeInitializationController(),
  );
  const initializationKey = JSON.stringify({
    account: currentAccount?.address?.toLowerCase() || '',
    chainEnum: navState?.chainEnum || '',
    tokenId: navState?.tokenId?.toLowerCase() || '',
    toChainEnum: navState?.toChainEnum || '',
    toTokenId: navState?.toTokenId?.toLowerCase() || '',
  });

  useEffect(() => {
    if (!active) {
      return;
    }

    const controller = initializationControllerRef.current;
    const run = controller.begin(initializationKey);
    if (!run) {
      return;
    }

    const canCommit = () => controller.isCurrent(run);

    const initializeBridge = async () => {
      setAmount('');
      setSlider(0);
      setUseSlider(false);
      setIsDraggingSlider(false);

      let effectiveFromChain = latestFromChainRef.current;
      const routeFromChain = navState?.chainEnum
        ? findChainByEnum(navState.chainEnum, { fallback: true })?.enum ||
          CHAINS_ENUM.ETH
        : undefined;
      const routeToChain = navState?.toChainEnum
        ? findChainByEnum(navState.toChainEnum, { fallback: true })?.enum ||
          CHAINS_ENUM.ETH
        : undefined;

      if (routeFromChain && canCommit()) {
        wrappedSwitchFromChain(routeFromChain, false);
        setFromToken({
          ...getChainDefaultToken(routeFromChain),
          id: navState?.tokenId || getChainDefaultToken(routeFromChain).id,
        });
        effectiveFromChain = routeFromChain;
      } else if (!isFromChainInitializedRef.current) {
        let firstChainEnum = CHAINS_ENUM.ETH;
        try {
          const { firstChain } = await fetchOrderedChainList({
            address: currentAccount?.address,
            supportChains: supportedChains,
          });
          firstChainEnum = firstChain?.enum || CHAINS_ENUM.ETH;
        } catch (error) {
          console.error('Bridge fetchOrderedChainList error', error);
        }

        if (!canCommit()) {
          return;
        }

        if (!isFromChainInitializedRef.current) {
          wrappedSwitchFromChain(firstChainEnum);
          effectiveFromChain = firstChainEnum;
        } else {
          effectiveFromChain = latestFromChainRef.current;
        }
      }

      if (routeToChain && canCommit()) {
        wrappedSwitchToChain(routeToChain, false);
        setToToken({
          ...getChainDefaultToken(routeToChain),
          id: navState?.toTokenId || getChainDefaultToken(routeToChain).id,
        });
        return;
      }

      if (
        !canCommit() ||
        !userAddress ||
        !effectiveFromChain ||
        isToChainInitializedRef.current
      ) {
        return;
      }

      try {
        const latestTx = await openapi.getBridgeHistoryList({
          user_addr: userAddress,
          start: 0,
          limit: 1,
          is_all: true,
        });
        if (
          !canCommit() ||
          latestFromChainRef.current !== effectiveFromChain ||
          isToChainInitializedRef.current
        ) {
          return;
        }

        const latestToToken = latestTx?.history_list?.[0]?.to_token;
        const latestToChain = latestToToken
          ? findChainByServerID(latestToToken.chain)?.enum
          : undefined;
        if (
          latestToToken &&
          latestToChain &&
          latestToChain !== effectiveFromChain
        ) {
          wrappedSwitchToChain(latestToChain);
          setToToken(latestToToken);
          return;
        }
      } catch (error) {
        console.error('Bridge getBridgeHistoryList error', error);
      }

      if (
        !canCommit() ||
        latestFromChainRef.current !== effectiveFromChain ||
        isToChainInitializedRef.current
      ) {
        return;
      }

      try {
        const data = await openapi.getRecommendBridgeToChain({
          from_chain_id: findChainByEnum(effectiveFromChain)!.serverId,
        });
        if (
          !canCommit() ||
          latestFromChainRef.current !== effectiveFromChain ||
          isToChainInitializedRef.current
        ) {
          return;
        }

        wrappedSwitchToChain(findChainByServerID(data.to_chain_id)?.enum);
      } catch (error) {
        console.error('Bridge getRecommendBridgeToChain error', error);
      }
    };

    initializeBridge()
      .then(() => {
        controller.complete(run);
      })
      .catch(error => {
        controller.fail(run);
        console.error('Bridge initialization error', error);
      });

    return () => {
      controller.cancel(run);
    };
  }, [
    active,
    currentAccount?.address,
    fetchOrderedChainList,
    initializationKey,
    navState?.chainEnum,
    navState?.tokenId,
    navState?.toChainEnum,
    navState?.toTokenId,
    setFromToken,
    setIsDraggingSlider,
    setSlider,
    setToToken,
    setUseSlider,
    supportedChains,
    userAddress,
    wrappedSwitchFromChain,
    wrappedSwitchToChain,
  ]);

  useEffect(() => {
    setQuotesList([]);
    setRecommendFromToken(undefined);
    setSelectedBridgeQuote(undefined);
  }, [fromToken?.id, toToken?.id, fromChain, toChain, setSelectedBridgeQuote]);

  useEffect(() => {
    if (active && !canRequestQuote) {
      setQuotesList([]);
      setRecommendFromToken(undefined);
      setSelectedBridgeQuote(undefined);
    }
  }, [active, canRequestQuote, setSelectedBridgeQuote]);

  useEffect(() => {
    if (!enableInsufficientQuote || !amount || Number(amount) === 0) {
      setQuotesList([]);
      setRecommendFromToken(undefined);
      setSelectedBridgeQuote(undefined);
    }
  }, [amount, setSelectedBridgeQuote]);

  useEffect(() => {
    setAmount('');
    setSlider(0);
    setUseSlider(false);
    setIsDraggingSlider(false);
  }, [fromChain, setIsDraggingSlider, setSlider, setUseSlider]);

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
        setTokenRefreshId(e => e + 1);
      };
      eventBus.addListener(EVENTS.RELOAD_TX, refresh);
      return () => {
        eventBus.removeListener(EVENTS.RELOAD_TX, refresh);
      };
    }, [active, setTokenRefreshId]),
  );

  useClearMiniGasStateEffect({
    chainServerId: findChainByEnum(fromChain)?.serverId || '',
    enabled: active,
  });

  const selectedBridgeQuoteLoaded =
    !!selectedBridgeQuote &&
    quoteList.some(
      quote => !quote.loading && isSameBridgeQuote(quote, selectedBridgeQuote),
    );
  const selectedBridgeQuoteCanDisplay =
    !!toToken &&
    selectedBridgeQuoteLoaded &&
    (bridgeQuoteRequestFinished ||
      canDisplayBridgeQuoteBeforeAllQuotesLoaded({
        quote: selectedBridgeQuote,
        fromToken,
        toToken,
        amount,
      }));
  const quoteDisplayLoading =
    !selectedBridgeQuoteCanDisplay && hasPendingBridgeQuote;

  return {
    clearExpiredTimer,

    fromChain,
    fromToken,
    setFromToken,
    switchFromChain: wrappedSwitchFromChain,
    toChain,
    toToken,
    setToToken,
    switchToChain: wrappedSwitchToChain,
    switchToken,

    recommendFromToken,
    fillRecommendFromToken,

    inSufficient,
    inSufficientCanGetQuote,
    quoteBlockedByClosedMarket,
    amount,
    handleAmountChange,
    showLoss,

    openQuotesList,
    quoteLoading: quoteDisplayLoading,
    allQuotesLoaded: bridgeQuoteRequestFinished,
    quoteRequestId,
    quoteList,
    setQuotesList,

    bestQuoteId,
    selectedBridgeQuote,

    gasLimit,
    gasList,
    passGasPrice,
    handleMax,
    clickMaxBtnCount,
    isMaxRef,
    payTokenIsNativeToken,

    setSelectedBridgeQuote,
    setAutoQuoteRefreshPaused,
    setReloadTxRefreshPaused,
    ...slippageObj,

    onChangeSlider,
    slider,
  };
};
