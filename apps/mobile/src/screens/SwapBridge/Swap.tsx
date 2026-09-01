import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';
import { RabbyFeePopup } from '@/components/RabbyFeePopup';
import NormalScreenContainer2024 from '@/components2024/ScreenContainer/NormalScreenContainer';
import type { RootNames } from '@/constant/layout';
import {
  DEX_WITH_WRAP,
  getChainDefaultToken,
  getDefaultSwapToTokenItem,
} from '@/constant/swap';
import { swapServiceApi } from '@/core/serviceApi/swap';
import { setReportActionTs } from '@/core/serviceApi/preference';
import { transactionHistoryServiceApi } from '@/core/serviceApi/transactionHistory';
import { useTheme2024 } from '@/hooks/theme';
import {
  getMarketTabActionPrefix,
  getMarketTabCreateSwapTxAction,
} from '@/screens/Market/analytics';
import { findChainByEnum, findChainByServerID } from '@/utils/chain';
import { createGetStyles2024 } from '@/utils/styles';
import { CHAINS, CHAINS_ENUM } from '@debank/common';
import { DEX_ENUM, DEX_SPENDER_WHITELIST } from '@rabby-wallet/rabby-swap';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import type { CompositeScreenProps } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useMemoizedFn, useRequest } from 'ahooks';
import BigNumber from 'bignumber.js';
import { useAtomValue, useSetAtom } from 'jotai';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { ChainInfo2024 } from '../Send/components/ChainInfo2024';
import { SwapHeader } from '../Swap/components/Header';
import { LowCreditModal } from '../Swap/components/LowCreditModal';
import { QuoteList, Quotes } from '../Swap/components/Quotes';
import { TwpStepApproveModal } from '../Swap/components/TwoStepApproveModal';
import {
  useDetectLoss,
  useSlippageStore,
  useSwapScreenRenderState,
  useSwapUnlimitedAllowance,
  useTokenPair,
  isMEVProtectionSupported,
} from '../Swap/hooks';
import { refreshIdAtom, useRabbyFeeVisible } from '../Swap/hooks/atom';
import { buildDexSwap, dexSwap } from '../Swap/hooks/swap';
import { Button } from '@/components2024/Button';
import { SignRiskWarning } from '@/components/SignRiskWarning';
import type { PropsForAccountSwitchScreen } from '@/hooks/accountsSwitcher';
import {
  ScreenSceneAccountProvider,
  useSceneAccountInfo,
} from '@/hooks/accountsSwitcher';
import { useSafeSizes } from '@/hooks/useAppLayout';
import {
  SwapPendingTransactionsController,
  type SwapPendingTransactionsControllerRef,
} from '../Swap/components/SwapPendingTransactionsController';
import { SwapTokenItem } from '../Swap/components/Token';
import BridgeSwitchBtn from '../Bridge/components/BridgeSwitchBtn';
import BridgeShowMore from '../Bridge/components/BridgeShowMore';
import { useSwapRecentToTokens } from '../Swap/hooks/recent';
import { useSwitchSceneAccountOnSelectedTokenWithOwner } from '@/databases/hooks/token';
import type {
  GetNestedScreenRouteProp,
  RootStackParamsList,
  TransactionNavigatorParamList,
} from '@/navigation-type';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { REPORT_TIMEOUT_ACTION_KEY } from '@/core/utils/reportTimeoutAction';
import {
  ExternalSwapBridgeDappTips,
  SwapBridgeDappPopup,
} from '@/components/ExternalSwapBridgeDappPopup';
import { useExternalSwapBridgeDapps } from '@/components/ExternalSwapBridgeDappPopup/hook';
import { Tip } from '@/components';
import { useMiniSigner } from '@/hooks/useSigner';
import { isAccountSupportMiniApproval } from '@/utils/account';
import { ApprovePendingTxItem } from '../Swap/components/PendingTxItem';
import { toast } from '@/components2024/Toast';
import { last } from 'lodash';
import type { SwapTxHistoryItem } from '@/core/services/transactionHistory';
import { matomoRequestEvent } from '@/utils/analytics';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { useTwoStepSwap } from '../Swap/hooks/twoStepSwap';
import type { DirectSignBtnMethods } from '@/components2024/DirectSignBtn';
import { DirectSignBtn } from '@/components2024/DirectSignBtn';
import useDebounce from 'react-use/lib/useDebounce';
import { MINI_SIGN_ERROR } from '@/components2024/MiniSignV2/state/SignatureManager';
import { SignatureInstanceProvider } from '@/components2024/MiniSignV2/state/SignatureInstanceContext';
import { useSignatureStoreOf } from '@/components2024/MiniSignV2/state/useSignatureStore';
import {
  canProcessSignature,
  isSignatureGasFeeTooHigh,
  selectSignatureGuardFlags,
} from '@/components2024/MiniSignV2/state/signatureGuardFlags';
import { buildFingerprint } from '@/components2024/MiniSignV2/domain/ctx';
import { MarketClosedTip } from '@/components/Token/MarketClosedTip';
import { APP_VERSIONS } from '@/constant';
import { stats } from '@/utils/stats';
import { Text } from '@/components/Typography';
import { storeApiExpSettingData } from '@/hooks/appSettings';
import type { FormAmountMode } from '@/utils/form';
import { FormValuesOnSubmit, createAmountComparer } from '@/utils/form';
import { useMiniSignerEffectPause } from '@/hooks/useMiniSignerEffectPause';
import {
  hasQuotePollingPauseReason,
  type QuotePollingPauseReasonState,
  updateQuotePollingPauseReason,
} from '@/utils/quotePolling';
import ArrowDownSVG from '@/assets/icons/common/arrow-down-cc.svg';
import {
  ensureFeatureActivation,
  markFeatureActivation,
} from '@/core/utils/featureActivationDiagnostics';
import { useRegressionScenario } from '@/devtools/regressionScenarios/react';
import { shouldClearConsumedSwapNavigationParams } from './navigationParams';

const isAndroid = Platform.OS === 'android';
const BOTTOM_BUTTON_HEIGHT = 52;
const BOTTOM_BUTTON_TITLE_FONT_SIZE = 18;
const BOTTOM_BUTTON_HORIZONTAL_PADDING = 20;
const BOTTOM_BUTTON_BOTTOM_OFFSET = 36;
const BUILD_SWAP_TXS_DEBOUNCE_MS = 500;
const DEFAULT_REGRESSION_TARGET_USD = '0.1';
const DEFAULT_REGRESSION_MAX_TOTAL_USD = '1';

type SwapRouteProps = CompositeScreenProps<
  NativeStackScreenProps<
    TransactionNavigatorParamList,
    typeof RootNames.SwapBridge
  >,
  NativeStackScreenProps<RootStackParamsList>
>;

type SwapProps = PropsForAccountSwitchScreen<{
  disableHeaderRight?: boolean;
  disableAccountSwitcherModal?: boolean;
  diagnosticActive?: boolean;
  sceneActive?: boolean;
}>;

function SwapActivationDataProbe({
  currentAddress,
  payTokenChain,
  payTokenId,
  receiveTokenChain,
  receiveTokenId,
}: {
  currentAddress?: string;
  payTokenChain?: string;
  payTokenId?: string;
  receiveTokenChain?: string;
  receiveTokenId?: string;
}) {
  useEffect(() => {
    if (!currentAddress || !payTokenId || !receiveTokenId) {
      return;
    }

    const cycleId = ensureFeatureActivation('swap', 'swap_data_probe');
    markFeatureActivation('swap', 'data-ready', {
      cycleId,
      reason: 'swap_token_pair_ready',
      detail: `${payTokenChain}:${payTokenId}->${receiveTokenChain}:${receiveTokenId}`,
    });
  }, [
    currentAddress,
    payTokenChain,
    payTokenId,
    receiveTokenChain,
    receiveTokenId,
  ]);

  return null;
}

function readRegressionUsdParam(value: string | undefined, fallback: string) {
  const parsed = new BigNumber(value || fallback);
  return parsed.isFinite() && parsed.gt(0) ? parsed : new BigNumber(fallback);
}

function readRegressionSwapChain(value: string | undefined) {
  const normalized = (value || 'polygon').toLowerCase();
  if (normalized === 'polygon' || normalized === 'matic') {
    return CHAINS_ENUM.POLYGON;
  }
  return findChainByServerID(normalized)?.enum || CHAINS_ENUM.POLYGON;
}

function isSameTokenId(left?: string, right?: string) {
  return !!left && !!right && left.toLowerCase() === right.toLowerCase();
}

function formatSafeHash(hash?: string) {
  if (!hash) {
    return '';
  }
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function isRegressionBroadcastRequested(
  params: Readonly<Record<string, string>>,
) {
  const value = params.broadcast;
  return !!value && ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function isSameAmountValue(current: string | undefined, target: BigNumber) {
  const parsed = new BigNumber(current || 0);
  return parsed.isFinite() && parsed.eq(target);
}

const Swap = ({
  isForMultipleAddress = false,
  disableHeaderRight = false,
  disableAccountSwitcherModal = false,
  diagnosticActive = false,
  sceneActive = true,
}: SwapProps) => {
  /** Swap form snapshot for validation during auth */
  interface SwapFormSnapshot {
    amount: string;
    amountMode?: FormAmountMode;
  }

  // Form values snapshot for validation before auth submission
  const formValuesRef = useRef(
    new FormValuesOnSubmit<SwapFormSnapshot>({
      comparers: {
        amount: createAmountComparer(),
      },
    }),
  );

  const { switchAccountOnSelectedToken } =
    useSwitchSceneAccountOnSelectedTokenWithOwner('MakeTransactionAbout');

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });

  const { t } = useTranslation();
  const keyboardAwareRef = useRef<KeyboardAwareScrollView>(null);

  const { colors2024, styles } = useTheme2024({ getStyle });
  const pendingTransactionsRef =
    useRef<SwapPendingTransactionsControllerRef>(null);
  const [hasSwapProgress, setHasSwapProgress] = useState(false);

  const [twoStepApproveModalVisible, setTwoStepApproveModalVisible] =
    useState(false);

  const [unlimitedAllowance] = useSwapUnlimitedAllowance();

  const userAddress = currentAccount?.address;

  const {
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

    handleAmountChange,
    payAmount,
    isWrapToken,
    inSufficient,
    slippageChanged,
    slippageState,
    slippage: _slippage,
    setSlippage,
    payTokenIsNativeToken,
    isSlippageHigh,
    isSlippageLow,

    feeRate,

    openQuotesList,
    closeQuotesList,
    quotesListVisible,
    quoteLoading,
    allQuotesLoaded,
    quoteRequestId,
    quoteList,

    currentProvider: activeProvider,
    setActiveProvider,
    slippageValidInfo,

    gasList,
    passGasPrice,
    slider,
    onChangeSlider,

    lowCreditToken: _lowCreditToken,
    lowCreditVisible,
    setLowCreditToken,
    setLowCreditVisible,

    swapUseSlider,
    clearExpiredTimer,
    setAutoQuoteRefreshPaused,
    setReloadTxRefreshPaused,
    quoteRefreshCountdown,
    inSufficientCanGetQuote,
    quoteBlockedByClosedMarket,

    autoSuggestSlippage,
  } = useTokenPair({
    account: currentAccount!,
    active: sceneActive,
  });
  const quotePollingPauseReasonsRef = useRef<QuotePollingPauseReasonState>({});
  const setQuotePollingPauseReason = useCallback(
    (reason: string, paused: boolean) => {
      const wasPaused = hasQuotePollingPauseReason(
        quotePollingPauseReasonsRef.current,
      );

      quotePollingPauseReasonsRef.current = updateQuotePollingPauseReason({
        state: quotePollingPauseReasonsRef.current,
        reason,
        paused,
      });

      const isPaused = hasQuotePollingPauseReason(
        quotePollingPauseReasonsRef.current,
      );

      if (wasPaused !== isPaused) {
        setAutoQuoteRefreshPaused(isPaused);
      }
    },
    [setAutoQuoteRefreshPaused],
  );
  const setSlippageOptionsQuoteRefreshPaused = useCallback(
    (paused: boolean) => {
      setQuotePollingPauseReason('slippage-options', paused);
    },
    [setQuotePollingPauseReason],
  );
  const setGasSettingsQuoteRefreshPaused = useCallback(
    (paused: boolean) => {
      setQuotePollingPauseReason('gas-settings', paused);
    },
    [setQuotePollingPauseReason],
  );
  const setDepositQuoteRefreshPaused = useCallback(
    (paused: boolean) => {
      setQuotePollingPauseReason('gas-account-deposit', paused);
    },
    [setQuotePollingPauseReason],
  );

  useEffect(() => {
    setQuotePollingPauseReason('scene-inactive', !sceneActive);
  }, [sceneActive, setQuotePollingPauseReason]);

  const chainServerId = useMemo(() => {
    return findChainByEnum(chain)?.serverId || CHAINS[chain].serverId;
  }, [chain]);

  const {
    autoSlippage,
    isCustomSlippage,
    setAutoSlippage,
    setIsCustomSlippage,
  } = useSlippageStore();

  const slippage = useMemo(
    () => (autoSlippage ? autoSuggestSlippage : _slippage),
    [_slippage, autoSlippage, autoSuggestSlippage],
  );

  const {
    isSupportedChain,
    data: externalDapps,
    openTab: _openTab,
  } = useExternalSwapBridgeDapps(chain, 'swap', sceneActive);
  const openTab = useMemoizedFn((url: string) => {
    _openTab(url);
    const origin = safeGetOrigin(url);
    if (origin) {
      matomoRequestEvent({
        category: 'Websites Usage',
        action: 'Website_Visit_Other',
        label: origin,
      });
    }
  });
  const [swapDappOpen, setSwapDappOpen] = useState(false);

  const refresh = useSetAtom(refreshIdAtom);
  const refreshId = useAtomValue(refreshIdAtom);

  const [
    { visible: isShowRabbyFeePopup, dexName, dexFeeDesc },
    setIsShowRabbyFeePopup,
  ] = useRabbyFeeVisible();

  const switchPreferMEV = useMemoizedFn((bool: boolean) => {
    swapServiceApi.setSwapPreferMEVGuarded(bool).catch(error => {
      console.error('[Swap] persist MEV preference failed', error);
    });
    mutateMEVProtection(bool);
  });

  const {
    data: storedMEVProtection,
    mutate: mutateMEVProtection,
    run: loadMEVProtection,
  } = useRequest(
    async () => {
      return swapServiceApi.getSwapPreferMEVGuarded();
    },
    { manual: true },
  );

  useEffect(() => {
    if (sceneActive) {
      loadMEVProtection();
    }
  }, [loadMEVProtection, sceneActive]);

  const mevProtection = storedMEVProtection ?? true;

  const preferMEVGuarded = useMemo(
    () => (isMEVProtectionSupported(chain) ? mevProtection : false),
    [chain, mevProtection],
  );
  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'TransactionNavigatorParamList',
        typeof RootNames.SwapBridge | typeof RootNames.MultiSwapBridge
      >
    >();
  const navState = route.params;
  const regressionScenario = useRegressionScenario<'SwapBridge'>();
  const swapFundedAmountAppliedRunIdRef = useRef('');
  const swapFundedSubmitStartedRunIdRef = useRef('');
  const regressionBroadcastRequested =
    regressionScenario.active &&
    regressionScenario.scenario === 'swap-funded' &&
    isRegressionBroadcastRequested(regressionScenario.params);

  const initialActivationHandledRef = useRef(false);
  useEffect(() => {
    if (!sceneActive || initialActivationHandledRef.current) {
      return;
    }
    initialActivationHandledRef.current = true;
    setReportActionTs(REPORT_TIMEOUT_ACTION_KEY.CLICK_GO_SWAP_SERVICE).catch(
      console.error,
    );

    if (!navState?.chainEnum) {
      return;
    }

    const chainItem = findChainByEnum(navState?.chainEnum, { fallback: true });

    if (navState.swapAgain) {
      switchSwapAgain(
        chainItem?.enum || CHAINS_ENUM.ETH,
        navState?.swapTokenId?.[0]!,
        navState?.swapTokenId?.[1]!,
      );
      return;
    }
  }, [
    navState?.chainEnum,
    navState?.swapAgain,
    navState?.swapTokenId,
    sceneActive,
    switchSwapAgain,
  ]);

  const navigation = useNavigation<SwapRouteProps['navigation']>();

  const {
    prefetch: prefetchMiniSigner,
    openDirect,
    close: closeMiniSigner,
    instance,
  } = useMiniSigner({
    account: currentAccount!,
    chainServerId,
    autoResetGasStoreOnChainChange: true,
  });

  const signatureGuardFlags = useSignatureStoreOf(
    instance,
    selectSignatureGuardFlags,
  );
  const miniSignGasFeeTooHigh = isSignatureGasFeeTooHigh(signatureGuardFlags);
  const canDirectSign = canProcessSignature(signatureGuardFlags);

  const miniSignGa = useMemo(
    () => ({
      category: 'Swap',
      source: 'swap',
      swapUseSlider,
    }),
    [swapUseSlider],
  );

  useEffect(() => {
    if (!sceneActive) {
      return;
    }
    const chainItem = findChainByEnum(navState?.chainEnum, { fallback: true });
    const isBuy = navState?.type === 'Buy';

    if (navState?.tokenId) {
      markExplicitSwapSelection();
    }

    if (navState?.isFromSwap) {
      if (navState?.tokenId && chainItem?.enum === chain) {
        if (
          (payToken && payToken.chain !== chainItem.serverId) ||
          (receiveToken && receiveToken.chain !== chainItem.serverId)
        ) {
          switchChain(chainItem?.enum || CHAINS_ENUM.ETH, {
            payTokenId: navState?.tokenId,
            changeTo: isBuy,
          });
          return;
        }
        if (isBuy) {
          setReceiveToken({
            ...getChainDefaultToken(chainItem?.enum || CHAINS_ENUM.ETH),
            id: navState?.tokenId,
          });
        } else {
          setPayToken({
            ...getChainDefaultToken(chainItem?.enum || CHAINS_ENUM.ETH),
            id: navState?.tokenId,
          });
        }
        return;
      }
    } else {
      if (navState?.tokenId) {
        switchChain(chainItem?.enum || CHAINS_ENUM.ETH, {
          payTokenId: navState?.tokenId,
          changeTo: isBuy,
          payUseBaseToken: navState?.isFromCopyTrading,
        });
      }
    }
    if (shouldClearConsumedSwapNavigationParams(navState)) {
      navigation.setParams({
        ...navState,
        isSwapToTokenDetail: false,
        isFromSwap: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    navState?.chainEnum,
    navState?.isSwapToTokenDetail,
    navState?.tokenId,
    navState?.type,
    sceneActive,
  ]);

  useEffect(() => {
    if (
      !sceneActive ||
      !regressionScenario.active ||
      regressionScenario.scenario !== 'swap-funded'
    ) {
      return;
    }

    const targetChain = readRegressionSwapChain(
      regressionScenario.params.chain,
    );
    const shouldBroadcast = isRegressionBroadcastRequested(
      regressionScenario.params,
    );
    const targetChainInfo = findChainByEnum(targetChain);
    const targetPayToken = getChainDefaultToken(targetChain);
    const targetReceiveToken = getDefaultSwapToTokenItem(targetChain);

    if (
      chain !== targetChain ||
      payToken?.chain !== targetChainInfo?.serverId ||
      !isSameTokenId(payToken?.id, targetPayToken.id)
    ) {
      switchChain(targetChain, {
        payTokenId: targetPayToken.id,
        changeTo: false,
        markExplicitSelection: true,
      });
      return;
    }

    if (
      targetReceiveToken &&
      (!receiveToken ||
        receiveToken.chain !== targetReceiveToken.chain ||
        !isSameTokenId(receiveToken.id, targetReceiveToken.id))
    ) {
      setReceiveToken(targetReceiveToken);
      return;
    }

    if (swapFundedSubmitStartedRunIdRef.current === regressionScenario.runId) {
      return;
    }

    const price = new BigNumber(payToken?.price || 0);
    if (!price.gt(0)) {
      return;
    }

    const targetUsd = readRegressionUsdParam(
      regressionScenario.params.targetUsd,
      DEFAULT_REGRESSION_TARGET_USD,
    );
    const maxTotalUsd = readRegressionUsdParam(
      regressionScenario.params.maxTotalUsd,
      DEFAULT_REGRESSION_MAX_TOTAL_USD,
    );
    const amount = targetUsd
      .div(price)
      .decimalPlaces(Math.min(payToken?.decimals || 18, 6), BigNumber.ROUND_UP);
    const actualUsd = amount.times(price);
    const balance = new BigNumber(payToken?.raw_amount_hex_str || 0, 16).div(
      new BigNumber(10).pow(payToken?.decimals || 18),
    );

    if (!amount.gt(0) || actualUsd.gt(maxTotalUsd) || !balance.gt(amount)) {
      if (regressionScenario.claimOnce('swap-funded-amount-invalid')) {
        regressionScenario.report('assertion', {
          assertion: 'swap-funded-amount-valid',
          passed: false,
          chain: targetChainInfo?.serverId,
          token: payToken?.symbol,
          targetUsd: targetUsd.toString(10),
          actualUsd: actualUsd.toString(10),
          balance: balance.toString(10),
        });
      }
      return;
    }

    if (!isSameAmountValue(payAmount, amount)) {
      const hasApplied =
        swapFundedAmountAppliedRunIdRef.current === regressionScenario.runId;
      const assertion = hasApplied
        ? 'swap-funded-amount-reapplied'
        : 'swap-funded-amount-applied';
      handleAmountChange(amount.toString(10));
      if (!hasApplied || regressionScenario.claimOnce(assertion)) {
        regressionScenario.report('assertion', {
          assertion,
          passed: true,
          mode: shouldBroadcast ? 'broadcast' : 'dry-run',
          chain: targetChainInfo?.serverId,
          payToken: payToken?.symbol,
          receiveToken: targetReceiveToken?.symbol,
          amount: amount.toString(10),
          targetUsd: targetUsd.toString(10),
          actualUsd: actualUsd.toString(10),
        });
      }
      swapFundedAmountAppliedRunIdRef.current = regressionScenario.runId;
      return;
    }

    if (regressionScenario.claimOnce('swap-funded-form-amount-ready')) {
      regressionScenario.report('assertion', {
        assertion: 'swap-funded-form-amount-ready',
        passed: true,
        mode: shouldBroadcast ? 'broadcast' : 'dry-run',
        chain: targetChainInfo?.serverId,
        payToken: payToken?.symbol,
        receiveToken: targetReceiveToken?.symbol,
        amount: payAmount,
        targetUsd: targetUsd.toString(10),
        actualUsd: actualUsd.toString(10),
      });
    }
  }, [
    chain,
    handleAmountChange,
    payAmount,
    payToken,
    receiveToken,
    regressionScenario,
    sceneActive,
    setReceiveToken,
    switchChain,
  ]);

  useEffect(() => {
    if (
      !sceneActive ||
      !regressionScenario.active ||
      regressionScenario.scenario !== 'swap-funded' ||
      regressionBroadcastRequested
    ) {
      return;
    }

    if (
      !payToken ||
      !receiveToken ||
      !new BigNumber(payAmount || 0).gt(0) ||
      quoteLoading ||
      inSufficient ||
      !activeProvider?.quote
    ) {
      return;
    }

    if (!regressionScenario.claimOnce('swap-funded-dry-run-ready')) {
      return;
    }

    regressionScenario.report('assertion', {
      assertion: 'swap-funded-dry-run-ready',
      passed: true,
      mode: 'dry-run',
      chain: chainServerId,
      payToken: payToken.symbol,
      payTokenId: payToken.id,
      receiveToken: receiveToken.symbol,
      receiveTokenId: receiveToken.id,
      amount: payAmount,
      provider: activeProvider.name,
      quoteCount: quoteList.length,
    });
  }, [
    activeProvider?.name,
    activeProvider?.quote,
    chainServerId,
    inSufficient,
    payAmount,
    payToken,
    quoteList.length,
    quoteLoading,
    receiveToken,
    regressionScenario,
    regressionBroadcastRequested,
    sceneActive,
  ]);

  const { safeOffBottom } = useSafeSizes();

  const currentIsCopyTrading = useMemo(() => {
    if (navState?.type === 'Sell') {
      return (
        navState?.isFromCopyTrading &&
        payToken?.id === navState?.tokenId &&
        chain === navState.chainEnum
      );
    }

    return (
      navState?.isFromCopyTrading &&
      receiveToken?.id === navState?.tokenId &&
      chain === navState.chainEnum
    );
  }, [navState, receiveToken?.id, chain, payToken?.id]);

  const gotoSwap = useMemoizedFn(async () => {
    if (!inSufficient && payToken && receiveToken && activeProvider?.quote) {
      try {
        setReloadTxRefreshPaused(true);
        const receive_token_amount = new BigNumber(
          activeProvider?.quote.toTokenAmount,
        )
          .div(
            10 **
              (activeProvider?.quote.toTokenDecimals || receiveToken.decimals),
          )
          .toNumber();
        const payTokenUsdValue =
          typeof payAmount === 'string' && payToken?.price
            ? (Number(payAmount || 0) * Number(payToken.price || 0)).toString()
            : '';
        const addSwapTxHistoryObj = {
          chainId: findChainByEnum(chain)?.id || 0,
          address: currentAccount?.address!,
          fromToken: payToken,
          toToken: receiveToken,
          slippage: new BigNumber(slippage).div(100).toNumber(),
          fromAmount: Number(payAmount),
          toAmount: receive_token_amount,
          dexId: activeProvider?.name || 'WrapToken',
          createdAt: Date.now(),
          status: 'pending' as SwapTxHistoryItem['status'],
          isFromCopyTrading: currentIsCopyTrading,
          copyTradingExtra: {
            type: navState?.type || 'Buy',
          },
        };
        await dexSwap(
          {
            swapPreferMEVGuarded: !!preferMEVGuarded,
            chain,
            quote: activeProvider?.quote,
            needApprove: activeProvider.shouldApproveToken,
            spender:
              activeProvider?.name === DEX_ENUM.WRAPTOKEN
                ? ''
                : DEX_SPENDER_WHITELIST[activeProvider.name][chain],
            pay_token_id: payToken.id,
            unlimited: unlimitedAllowance,
            shouldTwoStepApprove: activeProvider.shouldTwoStepApprove,
            gasPrice:
              payTokenIsNativeToken && passGasPrice
                ? gasList?.find(e => e.level === 'normal')?.price
                : undefined,
            postSwapParams: {
              quote: {
                pay_token_id: payToken.id,
                pay_token_amount: Number(payAmount),
                receive_token_id: receiveToken!.id,
                receive_token_amount: receive_token_amount,
                slippage: new BigNumber(slippage).div(100).toNumber(),
              },
              dex_id: activeProvider?.name || 'WrapToken',
              fee_rate: Number(feeRate),
            },
            account: currentAccount!,
            from: navState?.from,
            payUsdValue: payTokenUsdValue || '',
            dexId: activeProvider?.name || '',
          },
          {
            ga: {
              category: 'Swap',
              source: 'swap',
              trigger: 'home',
              swapUseSlider,
            },
          },
          addSwapTxHistoryObj,
        );
        handleAmountChange('');
        pendingTransactionsRef.current?.refreshLocal();
        setTimeout(() => {
          pendingTransactionsRef.current?.refreshRemote();
        }, 500);
      } catch (error) {
        console.error(error);
      } finally {
        setReloadTxRefreshPaused(false);
        refresh(e => e + 1);
      }
    }
  });

  const activeProviderBuildKey = useMemo(() => {
    if (!activeProvider?.quote || !payToken || !receiveToken) {
      return '';
    }

    const gasPrice =
      payTokenIsNativeToken && passGasPrice
        ? gasList?.find(e => e.level === 'normal')?.price
        : '';

    return [
      chain,
      payToken.id,
      receiveToken.id,
      payAmount,
      slippage,
      preferMEVGuarded ? '1' : '0',
      unlimitedAllowance ? '1' : '0',
      activeProvider.name,
      activeProvider.shouldApproveToken ? '1' : '0',
      activeProvider.shouldTwoStepApprove ? '1' : '0',
      activeProvider.quote.toTokenAmount,
      activeProvider.quote.toTokenDecimals || '',
      activeProvider.quote.tx?.to || '',
      activeProvider.quote.tx?.value || '',
      activeProvider.quote.tx?.data || '',
      gasPrice || '',
    ].join('|');
  }, [
    activeProvider?.name,
    activeProvider?.quote,
    activeProvider?.shouldApproveToken,
    activeProvider?.shouldTwoStepApprove,
    chain,
    gasList,
    passGasPrice,
    payAmount,
    payToken,
    payTokenIsNativeToken,
    preferMEVGuarded,
    receiveToken,
    slippage,
    unlimitedAllowance,
  ]);
  const activeProviderBuildKeyRef = useRef(activeProviderBuildKey);

  useEffect(() => {
    activeProviderBuildKeyRef.current = activeProviderBuildKey;
  }, [activeProviderBuildKey]);

  const activeProviderIsBestQuote =
    !!activeProvider && !!bestQuoteDex && activeProvider.name === bestQuoteDex;
  const activeProviderIsManualQuote = !!activeProvider?.manualClick;
  const activeProviderCanAutoPreExec =
    activeProviderIsBestQuote || activeProviderIsManualQuote;
  const builtSwapTxsKeyRef = useRef('');
  const prefetchedSwapTxsKeyRef = useRef('');

  const buildSwapTxs = useMemoizedFn(async (expectedBuildKey?: string) => {
    if (!inSufficient && payToken && receiveToken && activeProvider?.quote) {
      const buildKey = expectedBuildKey || activeProviderBuildKeyRef.current;
      if (expectedBuildKey && buildKey !== activeProviderBuildKeyRef.current) {
        return;
      }

      try {
        const result = await buildDexSwap(
          {
            swapPreferMEVGuarded: !!preferMEVGuarded,
            chain,
            quote: activeProvider?.quote,
            needApprove: activeProvider.shouldApproveToken,
            spender:
              activeProvider?.name === DEX_ENUM.WRAPTOKEN
                ? ''
                : DEX_SPENDER_WHITELIST[activeProvider.name][chain],
            pay_token_id: payToken.id,
            unlimited: unlimitedAllowance,
            shouldTwoStepApprove: activeProvider.shouldTwoStepApprove,
            gasPrice:
              payTokenIsNativeToken && passGasPrice
                ? gasList?.find(e => e.level === 'normal')?.price
                : undefined,
            postSwapParams: {
              quote: {
                pay_token_id: payToken.id,
                pay_token_amount: Number(payAmount),
                receive_token_id: receiveToken!.id,
                receive_token_amount: new BigNumber(
                  activeProvider?.quote.toTokenAmount,
                )
                  .div(
                    10 **
                      (activeProvider?.quote.toTokenDecimals ||
                        receiveToken.decimals),
                  )
                  .toNumber(),
                slippage: new BigNumber(slippage).div(100).toNumber(),
              },
              dex_id: activeProvider?.name || 'WrapToken',
              fee_rate: Number(feeRate),
            },
            account: currentAccount!,
          },
          {
            ga: {
              category: 'Swap',
              source: 'swap',
              trigger: 'home',
              swapUseSlider,
            },
          },
        );
        if (
          expectedBuildKey &&
          buildKey !== activeProviderBuildKeyRef.current
        ) {
          return;
        }
        builtSwapTxsKeyRef.current = buildKey;
        return result;
      } catch (error) {
        console.error(error);
      }
    }
  });

  const {
    data: txs,
    runAsync: runBuildSwapTxs,
    mutate: mutateTxs,
  } = useRequest(buildSwapTxs, {
    manual: true,
  });
  const runBuildSwapTxsRef = useRef<
    ReturnType<typeof runBuildSwapTxs> | undefined
  >(undefined);
  const runBuildSwapTxsKeyRef = useRef('');
  const buildSwapTxsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const swapAutoPreExecRef = useRef({
    requestId: 0,
    earlyBuildKey: '',
    finalBuildKey: '',
    manualBuildKey: '',
  });
  const quoteRequestIdRef = useRef(quoteRequestId);
  const allQuotesLoadedRef = useRef(allQuotesLoaded);

  useEffect(() => {
    quoteRequestIdRef.current = quoteRequestId;
  }, [quoteRequestId]);

  useEffect(() => {
    allQuotesLoadedRef.current = allQuotesLoaded;
  }, [allQuotesLoaded]);

  useEffect(() => {
    quoteRequestIdRef.current = quoteRequestId;
    swapAutoPreExecRef.current = {
      requestId: quoteRequestId,
      earlyBuildKey: '',
      finalBuildKey: '',
      manualBuildKey: '',
    };
    builtSwapTxsKeyRef.current = '';
    prefetchedSwapTxsKeyRef.current = '';
    mutateTxs([]);
    runBuildSwapTxsRef.current = undefined;
    runBuildSwapTxsKeyRef.current = '';
    if (buildSwapTxsTimerRef.current) {
      clearTimeout(buildSwapTxsTimerRef.current);
      buildSwapTxsTimerRef.current = null;
    }
  }, [mutateTxs, quoteRequestId]);

  const runBuildSwapTxsForKey = useMemoizedFn((buildKey: string) => {
    const buildPromise = runBuildSwapTxs(buildKey);
    runBuildSwapTxsRef.current = buildPromise;
    runBuildSwapTxsKeyRef.current = buildKey;
    buildPromise.finally(() => {
      if (runBuildSwapTxsRef.current === buildPromise) {
        runBuildSwapTxsRef.current = undefined;
        runBuildSwapTxsKeyRef.current = '';
      }
    });
    return buildPromise;
  });

  const [_, setRecentSwapToToken] = useSwapRecentToTokens();

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setIsSubmitting(false);
  }, [payAmount, payToken?.id, receiveToken?.id, chain]);

  const checkGasFeeTooHighRef = useRef(true);

  const directSignBtnRef = useRef<DirectSignBtnMethods>(null);
  const handlePayAmountChange = useMemoizedFn((value: string) => {
    if (directSignBtnRef.current?.isAuthInProgress()) {
      return;
    }
    handleAmountChange(value);
  });
  const handlePayTokenChange = useMemoizedFn((token: TokenItem) => {
    const chainItem = findChainByServerID(token.chain);
    const normalSetChainToken = () => {
      if (chainItem?.enum !== chain) {
        switchChain(chainItem?.enum || CHAINS_ENUM.ETH);
        setReceiveToken(undefined);
      }
      setPayToken(token);
    };

    if (!isForMultipleAddress) {
      normalSetChainToken();
      return;
    }

    switchAccountOnSelectedToken({
      token,
      currentAccount,
    });
    normalSetChainToken();
  });
  const handleReceiveTokenChange = useMemoizedFn((token: TokenItem) => {
    const chainItem = findChainByServerID(token.chain);
    if (chainItem?.enum !== chain) {
      switchChain(chainItem?.enum || CHAINS_ENUM.ETH);
      setPayToken(undefined);
    }
    setReceiveToken(token);

    if (token.low_credit_score) {
      setLowCreditToken(token);
      setLowCreditVisible(true);
    }
  });
  const payTokenExcludes = useMemo(
    () => (receiveToken?.id ? [receiveToken.id] : undefined),
    [receiveToken?.id],
  );
  const receiveTokenExcludes = useMemo(
    () => (payToken?.id ? [payToken.id] : undefined),
    [payToken?.id],
  );

  const onChangeCheckGasFeeTooHigh = useCallback((b: boolean) => {
    checkGasFeeTooHighRef.current = b;
  }, []);

  const buildFormSnapshot = useCallback(
    (): SwapFormSnapshot => ({
      amount: payAmount || '',
      amountMode: slider === 100 ? 'max' : 'exact',
    }),
    [payAmount, slider],
  );

  const handleSwap = useMemoizedFn(async (p?: { ignoreGasFee?: boolean }) => {
    if (storeApiExpSettingData.getShouldBlockSubmitIfFormChangedOnAuth()) {
      const snapshot = formValuesRef.current.getSnapshot();

      if (!snapshot) {
        toast.info(t('page.bridge.formChangedAmount'));
        return;
      }

      // Check if amount changed during authentication
      const comparison = formValuesRef.current.compare({
        amount: payAmount || '',
      });

      // If amount changed during authentication, close modal and alert user
      if (comparison.isChanged) {
        formValuesRef.current.clear();
        closeMiniSigner();
        Alert.alert(
          t('page.bridge.formChangedTitle') || 'Form Changed',
          t('page.bridge.formChangedAmount'),
          [{ text: t('global.ok') || 'OK' }],
        );
        refresh(e => e + 1);
        builtSwapTxsKeyRef.current = '';
        prefetchedSwapTxsKeyRef.current = '';
        runBuildSwapTxsRef.current = undefined;
        runBuildSwapTxsKeyRef.current = '';
        mutateTxs([]);
        return;
      }
    }

    // Clear snapshot after validation
    formValuesRef.current.clear();

    if (isSubmitting) {
      return;
    }
    if (receiveToken) {
      setRecentSwapToToken(receiveToken);
    }
    if (canShowDirectSubmit) {
      try {
        setIsSubmitting(true);
        setReloadTxRefreshPaused(true);

        if (buildSwapTxsTimerRef.current) {
          clearTimeout(buildSwapTxsTimerRef.current);
          buildSwapTxsTimerRef.current = null;
        }

        const currentBuildKey = activeProviderBuildKeyRef.current;
        const canReuseCurrentTxs =
          !!currentBuildKey &&
          builtSwapTxsKeyRef.current === currentBuildKey &&
          !!currentTxs?.length;
        let txsForSigning = canReuseCurrentTxs ? currentTxs : undefined;

        if (!txsForSigning?.length && currentBuildKey) {
          const reusableBuildPromise =
            runBuildSwapTxsKeyRef.current === currentBuildKey
              ? runBuildSwapTxsRef.current
              : undefined;
          const buildPromise =
            reusableBuildPromise || runBuildSwapTxsForKey(currentBuildKey);
          const rebuiltTxs = await buildPromise;
          if (rebuiltTxs?.length) {
            txsForSigning = rebuiltTxs;
          }
        }

        if (!txsForSigning?.length) {
          toast.info('please retry');
          throw new Error('no txs');
        }

        let txHash = '';

        clearExpiredTimer();
        setMiniSignLoading(true);

        const res = await openDirect({
          txs: txsForSigning,
          ga: miniSignGa,
          checkGasFeeTooHigh: checkGasFeeTooHighRef.current,
          ignoreGasFeeTooHigh: p?.ignoreGasFee || false,
        });
        txHash = last(res) || '';

        await miniSignNextStep(txHash);

        if (!isApprove) {
          builtSwapTxsKeyRef.current = '';
          prefetchedSwapTxsKeyRef.current = '';
          mutateTxs([]);
          const createdAt = Date.now();
          await transactionHistoryServiceApi.addSwapTxHistory({
            hash: txHash,
            chainId: findChainByEnum(chain)?.id || 0,
            address: currentAccount?.address!,
            fromToken: payToken!,
            toToken: receiveToken!,
            slippage: new BigNumber(slippage).div(100).toNumber(),
            fromAmount: Number(payAmount),
            toAmount: new BigNumber(activeProvider?.quote?.toTokenAmount!)
              .div(
                10 **
                  (activeProvider?.quote?.toTokenDecimals ||
                    receiveToken!.decimals),
              )
              .toNumber(),
            dexId: activeProvider?.name || 'WrapToken',
            createdAt,
            status: 'pending',
            isFromCopyTrading: currentIsCopyTrading,
            copyTradingExtra: {
              type: navState?.type || 'Buy',
            },
          });
          if (
            regressionBroadcastRequested &&
            regressionScenario.active &&
            regressionScenario.scenario === 'swap-funded' &&
            regressionScenario.claimOnce('swap-funded-broadcast-success')
          ) {
            regressionScenario.report('assertion', {
              assertion: 'swap-funded-broadcast-success',
              passed: true,
              mode: 'broadcast',
              txHash: formatSafeHash(txHash),
              chain: chainServerId,
              payToken: payToken?.symbol,
              payTokenId: payToken?.id,
              receiveToken: receiveToken?.symbol,
              receiveTokenId: receiveToken?.id,
              amount: payAmount,
              provider: activeProvider?.name,
            });
          }
          handleAmountChange('');
          setTimeout(() => {
            pendingTransactionsRef.current?.refreshRemote();
          }, 1000);
          pendingTransactionsRef.current?.refreshLocal();
          const marketTab = navState?.from?.scene
            ? getMarketTabActionPrefix(navState.from.scene)
            : null;
          const createSwapTxAction = navState?.from?.scene
            ? getMarketTabCreateSwapTxAction(navState.from.scene)
            : null;

          if (marketTab && createSwapTxAction) {
            const payTokenUsdValue =
              typeof payAmount === 'string' && payToken?.price
                ? (
                    Number(payAmount || 0) * Number(payToken.price || 0)
                  ).toString()
                : '';
            stats.report('memecoinSwapTx', {
              chain: chainServerId,
              tx_id: txHash,
              dex_id: activeProvider?.name || '',
              market_tab: marketTab,
              meme_chain: navState?.from?.chain || '',
              meme_ca: navState?.from?.id || '',
              meme_symbol: navState?.from?.symbol || '',
              user_addr: currentAccount?.address || '',
              pay_token_usd_value: payTokenUsdValue,
              create_at: createdAt,
              address_type: currentAccount?.type || '',
              app_version: APP_VERSIONS.fromNative || '0',
            });
            matomoRequestEvent({
              category: 'Rabby Market',
              action: createSwapTxAction,
            });
          }
          setReportActionTs(REPORT_TIMEOUT_ACTION_KEY.CLICK_SWAP_TO_CONFIRM, {
            chain: chainServerId,
          }).catch(console.error);
          if (currentIsCopyTrading) {
            matomoRequestEvent({
              category: 'CopyTrading',
              action:
                navState?.type === 'Sell'
                  ? 'CopyTrading_SellCreateSwap'
                  : 'CopyTrading_BuyCreateSwap',
            });
          }
        }
      } catch (error: any) {
        console.log('swap mini sign error', error);
        if (error === MINI_SIGN_ERROR.USER_CANCELLED) {
          refresh(e => e + 1);
          builtSwapTxsKeyRef.current = '';
          prefetchedSwapTxsKeyRef.current = '';
          mutateTxs([]);
        } else if (
          [
            MINI_SIGN_ERROR.GAS_FEE_TOO_HIGH,
            MINI_SIGN_ERROR.CANT_PROCESS,
          ].includes(error)
        ) {
        } else {
          await gotoSwap();
        }
      } finally {
        setReloadTxRefreshPaused(false);
        setIsSubmitting(false);
        setMiniSignLoading(false);
      }
    } else {
      gotoSwap();
    }
    setReportActionTs(REPORT_TIMEOUT_ACTION_KEY.CLICK_SWAP_OR_APPROVE_BTN, {
      chain: chainServerId,
    }).catch(console.error);
  });

  const lowCreditInit = useRef(false);

  const lowCreditToken = useMemo(() => {
    if (!navState) {
      return _lowCreditToken;
    }
    const isCopyTrading =
      navState?.isFromCopyTrading &&
      _lowCreditToken?.id === navState?.tokenId &&
      _lowCreditToken?.chain === findChainByEnum(navState.chainEnum)?.serverId;
    if (isCopyTrading) {
      return undefined;
    }
    return _lowCreditToken;
  }, [_lowCreditToken, navState]);

  const openFeePopup = useCallback(() => {
    if (isWrapToken) {
      return;
    }
    setIsShowRabbyFeePopup({
      visible: true,
      dexName: activeProvider?.name || undefined,
      dexFeeDesc: activeProvider?.quote?.dexFeeDesc || undefined,
    });
  }, [
    activeProvider?.name,
    activeProvider?.quote?.dexFeeDesc,
    isWrapToken,
    setIsShowRabbyFeePopup,
  ]);

  const [miniSignLoading, setMiniSignLoading] = useState(false);

  const {
    shouldTwoStep: shouldTwoStepSwap,
    currentTxs,
    next,
    isApprove,
    approvePending: approveTxPending,
    setApprovePending,
    approveHash,
  } = useTwoStepSwap({
    txs,
    chain,
    enable:
      !!currentAccount?.type &&
      isAccountSupportMiniApproval(currentAccount?.type),
    type: 'approveSwap',
    // onApprovePending,
  });

  const miniSignNextStep = async (hash: string) => {
    if (isApprove) {
      await transactionHistoryServiceApi.addApproveSwapTokenTxHistory({
        address: currentAccount?.address!,
        chainId: currentTxs![0]!.chainId,
        amount: Number(payAmount),
        token: payToken!,
        status: 'pending',
        createdAt: Date.now(),
        hash,
      });
      setApprovePending(true);
    }
    next(hash);
    setMiniSignLoading(false);
  };

  const showLoss = useDetectLoss({
    payToken,
    receiveToken,
    receiveRawAmount: activeProvider?.actualReceiveAmount || 0,
    payAmount,
  });

  const {
    canShowDirectSubmit,
    swapBtnDisabled,
    isPreviewVisible,
    noQuote,
    showClosedMarketTip,
    showRiskTips,
    showRiskConfirm,
    showTwoStepApproveProgress,
    showMEVGuardedSwitch,
    showPendingSwapProgress,
  } = useSwapScreenRenderState({
    form: {
      payAmount,
      payToken,
      receiveToken,
      inSufficient,
      inSufficientCanGetQuote,
      quoteBlockedByClosedMarket,
    },
    quote: {
      loading: quoteLoading,
      activeProvider,
      isSubmitting,
    },
    page: {
      chain,
      isSupportedChain,
    },
    risk: {
      isSlippageLow,
      isSlippageHigh,
      showLoss,
      gasFeeTooHigh: miniSignGasFeeTooHigh,
    },
    directSign: {
      accountType: currentAccount?.type,
    },
    twoStep: {
      shouldTwoStep: shouldTwoStepSwap,
      approveHash,
      currentTxChainId: currentTxs?.[0]?.chainId,
      hasCurrentAccount: !!currentAccount?.address,
    },
    pending: {
      hasSwapProgress,
      approveHash,
    },
  });

  const [sourceName, sourceLogo] = useMemo(() => {
    if (activeProvider?.name) {
      if (isWrapToken) {
        return [t('page.swap.wrap-contract'), receiveToken?.logo_url];
      }
      const currentDex = DEX_WITH_WRAP[activeProvider.name];
      return [currentDex.name, currentDex.logo];
    }
    return ['', ''];
  }, [activeProvider?.name, isWrapToken, t, receiveToken?.logo_url]);

  const [riskChecked, setRiskChecked] = useState(false);
  const riskConfirmKey = useMemo(
    () =>
      [
        showRiskConfirm,
        chain,
        payToken?.chain,
        payToken?.id,
        receiveToken?.chain,
        receiveToken?.id,
        payAmount,
        activeProvider?.name,
        activeProvider?.actualReceiveAmount,
        activeProvider?.quote?.tx?.data,
        isApprove,
        isSlippageLow,
        isSlippageHigh,
        showLoss,
        miniSignGasFeeTooHigh,
      ].join('|'),
    [
      showRiskConfirm,
      chain,
      payToken?.chain,
      payToken?.id,
      receiveToken?.chain,
      receiveToken?.id,
      payAmount,
      activeProvider?.name,
      activeProvider?.actualReceiveAmount,
      activeProvider?.quote?.tx?.data,
      isApprove,
      isSlippageLow,
      isSlippageHigh,
      showLoss,
      miniSignGasFeeTooHigh,
    ],
  );
  const riskConfirmDisabled = showRiskConfirm && !riskChecked;

  useEffect(() => {
    setRiskChecked(false);
  }, [riskConfirmKey]);

  const swapPreviewInfo = isPreviewVisible ? (
    <BridgeShowMore
      insufficient={inSufficient}
      autoSuggestSlippage={autoSuggestSlippage}
      supportDirectSign={canShowDirectSubmit}
      openFeePopup={openFeePopup}
      sourceName={sourceName}
      sourceLogo={sourceLogo}
      slippage={slippageState}
      displaySlippage={slippage}
      onSlippageChange={setSlippage}
      fromToken={payToken}
      toToken={receiveToken}
      amount={payAmount}
      toAmount={
        isWrapToken ? payAmount : activeProvider?.actualReceiveAmount || 0
      }
      openQuotesList={openQuotesList}
      quoteLoading={quoteLoading}
      slippageError={isSlippageHigh || isSlippageLow}
      autoSlippage={!!autoSlippage}
      isCustomSlippage={isCustomSlippage}
      setAutoSlippage={setAutoSlippage}
      setIsCustomSlippage={setIsCustomSlippage}
      type="swap"
      isWrapToken={isWrapToken}
      isRabbyFeeFree={!isWrapToken && feeRate === '0'}
      isRabbyFeeHalf={feeRate === '0.12'}
      isBestQuote={
        !!activeProvider &&
        !!bestQuoteDex &&
        bestQuoteDex === activeProvider?.name
      }
      showMEVGuardedSwitch={showMEVGuardedSwitch}
      originPreferMEVGuarded={mevProtection}
      switchPreferMEV={switchPreferMEV}
      recommendValue={
        slippageValidInfo?.is_valid
          ? undefined
          : slippageValidInfo?.suggest_slippage
      }
      onDepositPopupVisibleChange={setDepositQuoteRefreshPaused}
      onSlippageOptionsOpenChange={setSlippageOptionsQuoteRefreshPaused}
      onGasSettingsOpenChange={setGasSettingsQuoteRefreshPaused}
      renderSwapQuotes={onSelect =>
        userAddress && payToken && receiveToken && chain ? (
          <Quotes
            list={quoteList}
            activeName={activeProvider?.name}
            loading={quoteLoading}
            visible
            onClose={() => undefined}
            userAddress={userAddress}
            chain={chain}
            slippage={slippage}
            payToken={payToken}
            payAmount={payAmount}
            receiveToken={receiveToken}
            fee={feeRate}
            inSufficient={inSufficient}
            setActiveProvider={setActiveProvider}
            currentProvider={activeProvider}
            sortIncludeGasFee
            onSelect={onSelect}
            noPadding
          />
        ) : null
      }
      onRefreshSwapQuotes={() => refresh(e => e + 1)}
      swapQuotesLoading={quoteLoading}
    />
  ) : null;

  useEffect(() => {
    if (
      !sceneActive ||
      !regressionBroadcastRequested ||
      !regressionScenario.active ||
      regressionScenario.scenario !== 'swap-funded'
    ) {
      return;
    }

    if (
      !payToken ||
      !receiveToken ||
      !new BigNumber(payAmount || 0).gt(0) ||
      quoteLoading ||
      inSufficient ||
      !activeProvider?.quote ||
      swapBtnDisabled
    ) {
      return;
    }

    if (!canShowDirectSubmit) {
      if (regressionScenario.claimOnce('swap-funded-direct-submit-required')) {
        regressionScenario.report('assertion', {
          assertion: 'swap-funded-direct-submit-required',
          passed: false,
          mode: 'broadcast',
          reason: 'direct-submit-unavailable',
          chain: chainServerId,
          payToken: payToken.symbol,
          receiveToken: receiveToken.symbol,
        });
      }
      return;
    }

    if (slippageChanged) {
      if (regressionScenario.claimOnce('swap-funded-refresh-slippage')) {
        regressionScenario.report('assertion', {
          assertion: 'swap-funded-refresh-slippage',
          passed: true,
          mode: 'broadcast',
          chain: chainServerId,
        });
      }
      refresh(e => e + 1);
      return;
    }

    if (activeProvider?.shouldTwoStepApprove || shouldTwoStepSwap) {
      if (regressionScenario.claimOnce('swap-funded-two-step-unsupported')) {
        regressionScenario.report('assertion', {
          assertion: 'swap-funded-two-step-unsupported',
          passed: false,
          mode: 'broadcast',
          chain: chainServerId,
          payToken: payToken.symbol,
          receiveToken: receiveToken.symbol,
          provider: activeProvider.name,
        });
      }
      return;
    }

    if (showRiskConfirm && !riskChecked) {
      if (regressionScenario.claimOnce('swap-funded-risk-confirm-accepted')) {
        regressionScenario.report('assertion', {
          assertion: 'swap-funded-risk-confirm-accepted',
          passed: true,
          mode: 'broadcast',
          chain: chainServerId,
        });
      }
      setRiskChecked(true);
      return;
    }

    if (riskConfirmDisabled) {
      return;
    }

    if (!regressionScenario.claimOnce('swap-funded-submit-started')) {
      return;
    }

    formValuesRef.current.save(buildFormSnapshot());
    swapFundedSubmitStartedRunIdRef.current = regressionScenario.runId;
    regressionScenario.report('assertion', {
      assertion: 'swap-funded-submit-started',
      passed: true,
      mode: 'broadcast',
      chain: chainServerId,
      payToken: payToken.symbol,
      payTokenId: payToken.id,
      receiveToken: receiveToken.symbol,
      receiveTokenId: receiveToken.id,
      amount: payAmount,
      provider: activeProvider.name,
      quoteCount: quoteList.length,
    });
    handleSwap({ ignoreGasFee: riskChecked || showRiskConfirm });
  }, [
    activeProvider,
    buildFormSnapshot,
    canShowDirectSubmit,
    chainServerId,
    formValuesRef,
    handleSwap,
    inSufficient,
    payAmount,
    payToken,
    quoteList.length,
    quoteLoading,
    receiveToken,
    refresh,
    regressionBroadcastRequested,
    regressionScenario,
    riskChecked,
    riskConfirmDisabled,
    sceneActive,
    shouldTwoStepSwap,
    showRiskConfirm,
    slippageChanged,
    swapBtnDisabled,
  ]);

  const shouldPauseMiniSignerEffects =
    useMiniSignerEffectPause(miniSignLoading);

  useEffect(() => {
    if (!sceneActive) {
      closeMiniSigner();
      return;
    }
    if (shouldPauseMiniSignerEffects()) {
      return;
    }
    if (!canShowDirectSubmit || !currentAccount?.address) {
      closeMiniSigner();
      return;
    }
    if (!currentTxs?.length) {
      closeMiniSigner({ preserveManualGasMethod: true });
      return;
    }
    const canPrefetchCurrentTxs =
      canShowDirectSubmit &&
      activeProviderCanAutoPreExec &&
      !!builtSwapTxsKeyRef.current &&
      builtSwapTxsKeyRef.current === activeProviderBuildKeyRef.current;
    if (!canPrefetchCurrentTxs) {
      return;
    }
    const prefetchKey = [
      builtSwapTxsKeyRef.current,
      buildFingerprint(currentTxs || []),
    ].join('|');
    if (prefetchedSwapTxsKeyRef.current === prefetchKey) {
      return;
    }
    prefetchedSwapTxsKeyRef.current = prefetchKey;
    onChangeCheckGasFeeTooHigh(true);
    prefetchMiniSigner({
      txs: currentTxs,
      ga: miniSignGa,
      checkGasFeeTooHigh: true,
      synGasHeaderInfo: true,
    }).catch(error => {
      if (prefetchedSwapTxsKeyRef.current === prefetchKey) {
        prefetchedSwapTxsKeyRef.current = '';
      }
      console.error('swap mini signer prefetch failed', error);
    });
  }, [
    activeProviderBuildKey,
    activeProviderCanAutoPreExec,
    onChangeCheckGasFeeTooHigh,
    sceneActive,
    canShowDirectSubmit,
    currentAccount?.address,
    currentTxs,
    prefetchMiniSigner,
    closeMiniSigner,
    miniSignGa,
    shouldPauseMiniSignerEffects,
  ]);

  useEffect(() => {
    if (shouldPauseMiniSignerEffects()) {
      return;
    }
    if (!activeProvider) {
      if (buildSwapTxsTimerRef.current) {
        clearTimeout(buildSwapTxsTimerRef.current);
        buildSwapTxsTimerRef.current = null;
      }
      builtSwapTxsKeyRef.current = '';
      prefetchedSwapTxsKeyRef.current = '';
      runBuildSwapTxsRef.current = undefined;
      runBuildSwapTxsKeyRef.current = '';
      mutateTxs([]);
    }
  }, [activeProvider, mutateTxs, shouldPauseMiniSignerEffects]);

  useEffect(() => {
    const clearBuildTimer = () => {
      if (buildSwapTxsTimerRef.current) {
        clearTimeout(buildSwapTxsTimerRef.current);
        buildSwapTxsTimerRef.current = null;
      }
    };

    if (!sceneActive || shouldPauseMiniSignerEffects()) {
      return clearBuildTimer;
    }
    if (
      swapBtnDisabled ||
      !canShowDirectSubmit ||
      !activeProviderBuildKey ||
      !activeProviderCanAutoPreExec
    ) {
      return clearBuildTimer;
    }

    const tracker = swapAutoPreExecRef.current;
    if (tracker.requestId !== quoteRequestId) {
      tracker.requestId = quoteRequestId;
      tracker.earlyBuildKey = '';
      tracker.finalBuildKey = '';
      tracker.manualBuildKey = '';
    }

    const phase = allQuotesLoaded ? 'final' : 'early';
    if (activeProviderIsManualQuote) {
      if (tracker.manualBuildKey === activeProviderBuildKey) {
        return clearBuildTimer;
      }
    } else {
      if (!allQuotesLoaded && tracker.earlyBuildKey) {
        return clearBuildTimer;
      }
      if (allQuotesLoaded) {
        if (
          tracker.finalBuildKey === activeProviderBuildKey ||
          tracker.earlyBuildKey === activeProviderBuildKey
        ) {
          tracker.finalBuildKey = activeProviderBuildKey;
          return clearBuildTimer;
        }
      }
    }

    builtSwapTxsKeyRef.current = '';
    prefetchedSwapTxsKeyRef.current = '';
    mutateTxs([]);
    runBuildSwapTxsRef.current = undefined;
    runBuildSwapTxsKeyRef.current = '';

    const scheduledBuildKey = activeProviderBuildKey;
    const scheduledQuoteRequestId = quoteRequestId;
    const scheduledIsManualQuote = activeProviderIsManualQuote;
    buildSwapTxsTimerRef.current = setTimeout(() => {
      buildSwapTxsTimerRef.current = null;
      const latestTracker = swapAutoPreExecRef.current;
      if (
        quoteRequestIdRef.current !== scheduledQuoteRequestId ||
        latestTracker.requestId !== scheduledQuoteRequestId ||
        activeProviderBuildKeyRef.current !== scheduledBuildKey
      ) {
        return;
      }

      if (scheduledIsManualQuote) {
        if (latestTracker.manualBuildKey === scheduledBuildKey) {
          return;
        }
        latestTracker.manualBuildKey = scheduledBuildKey;
      } else if (phase === 'early') {
        if (allQuotesLoadedRef.current || latestTracker.earlyBuildKey) {
          return;
        }
        latestTracker.earlyBuildKey = scheduledBuildKey;
      } else {
        if (
          !allQuotesLoadedRef.current ||
          latestTracker.finalBuildKey === scheduledBuildKey
        ) {
          return;
        }
        latestTracker.finalBuildKey = scheduledBuildKey;
      }

      runBuildSwapTxsForKey(scheduledBuildKey);
    }, BUILD_SWAP_TXS_DEBOUNCE_MS);

    return clearBuildTimer;
  }, [
    activeProviderBuildKey,
    activeProviderCanAutoPreExec,
    activeProviderIsManualQuote,
    allQuotesLoaded,
    canShowDirectSubmit,
    mutateTxs,
    quoteRequestId,
    runBuildSwapTxsForKey,
    sceneActive,
    shouldPauseMiniSignerEffects,
    swapBtnDisabled,
  ]);

  useEffect(
    () => () => {
      closeMiniSigner();
    },
    [closeMiniSigner],
  );

  useEffect(() => {
    if (!sceneActive) {
      lowCreditInit.current = false;
    } else if (
      receiveToken &&
      receiveToken?.low_credit_score &&
      !lowCreditInit.current &&
      navState?.type !== 'Sell'
    ) {
      if (navState?.type === 'Buy' && navState?.tokenId !== receiveToken.id) {
        return;
      }
      setLowCreditToken(receiveToken);
      setLowCreditVisible(true);
      lowCreditInit.current = true;
    }
  }, [
    sceneActive,
    receiveToken,
    setLowCreditToken,
    setLowCreditVisible,
    navState,
  ]);

  const originBtnText = useMemo(() => {
    if (!isSupportedChain) {
      return t('component.externalSwapBrideDappPopup.swapOnDapp');
    }

    if (shouldTwoStepSwap) {
      if (!isApprove && !approveTxPending) {
        return t('page.swap.title');
      }
      return t('page.swap.approve');
    }

    if (canShowDirectSubmit) {
      return t('global.Confirm');
    }

    if (activeProvider?.shouldApproveToken) {
      return t('page.swap.approve-swap');
    }

    if (quoteLoading) {
      return t('page.swap.title');
    }

    return t('page.swap.title');
  }, [
    activeProvider?.shouldApproveToken,
    approveTxPending,
    canShowDirectSubmit,
    isApprove,
    isSupportedChain,
    quoteLoading,
    shouldTwoStepSwap,
    t,
  ]);

  const [latestQuoteBtnText, setLatestQuoteBtnText] = useState('');

  const btnText = latestQuoteBtnText || originBtnText;

  useDebounce(
    () => {
      if (originBtnText && activeProvider && !quoteLoading) {
        setLatestQuoteBtnText(originBtnText);
      }
    },
    300,
    [originBtnText, activeProvider, quoteLoading],
  );

  useDebounce(
    () => {
      setLatestQuoteBtnText(originBtnText);
    },
    300,
    [chain, payToken?.id, receiveToken?.id],
  );

  return (
    <SignatureInstanceProvider instance={instance}>
      <NormalScreenContainer2024 type="bg1">
        {diagnosticActive ? (
          <SwapActivationDataProbe
            currentAddress={currentAccount?.address}
            payTokenChain={payToken?.chain}
            payTokenId={payToken?.id}
            receiveTokenChain={receiveToken?.chain}
            receiveTokenId={receiveToken?.id}
          />
        ) : null}
        {isForMultipleAddress && !disableAccountSwitcherModal && (
          <AccountSwitcherModal forScene="MakeTransactionAbout" inScreen />
        )}
        <KeyboardAwareScrollView
          style={[
            styles.container,

            {
              marginBottom:
                112 +
                (isAndroid ? 20 + safeOffBottom : 0) +
                (showRiskTips ? 26 : 0),
            },
          ]}
          ref={keyboardAwareRef}
          // contentContainerStyle={styles.container}
          enableOnAndroid
          extraHeight={200}
          keyboardOpeningTime={0}>
          <View style={styles.content}>
            <Text style={[styles.label, styles.labelWithBottomSpacing]}>
              {t('page.swap.chain')}
            </Text>
            <ChainInfo2024
              chainEnum={chain}
              onChange={switchChain}
              // supportChains={SWAP_SUPPORT_CHAINS}
              hideTestnetTab
              account={currentAccount!}
              rightArrowIcon={
                <View style={styles.chainArrowIconContainer}>
                  <ArrowDownSVG
                    width={16}
                    height={16}
                    color={colors2024['neutral-body']}
                  />
                </View>
              }
            />
            <View style={styles.swapContainer}>
              <View style={styles.flex1}>
                <Text style={styles.label}>{t('page.swap.token')}</Text>
              </View>
            </View>
            <View style={styles.swapTokenContainer}>
              <View style={styles.swapTokenCard}>
                <SwapTokenItem
                  disabled={!isSupportedChain}
                  inSufficient={inSufficient}
                  slider={slider}
                  onChangeSlider={onChangeSlider}
                  value={payAmount}
                  onValueChange={handlePayAmountChange}
                  token={payToken}
                  onTokenChange={handlePayTokenChange}
                  account={currentAccount}
                  chainId={chainServerId}
                  type={'from'}
                  excludeTokens={payTokenExcludes}
                />
              </View>

              <View style={styles.swapTokenCard}>
                <SwapTokenItem
                  valueLoading={quoteLoading}
                  token={receiveToken}
                  onTokenChange={handleReceiveTokenChange}
                  value={
                    !activeProvider
                      ? ''
                      : activeProvider?.actualReceiveAmount
                      ? activeProvider?.actualReceiveAmount + ''
                      : isWrapToken
                      ? payAmount
                      : '0'
                  }
                  account={currentAccount}
                  chainId={chainServerId}
                  type={'to'}
                  currentQuote={activeProvider}
                  // placeholder={t('page.swap.search-by-name-address')}
                  excludeTokens={receiveTokenExcludes}
                />
              </View>
              <BridgeSwitchBtn
                onPress={exchangeToken}
                style={styles.arrowWrapper}
                loading={quoteLoading}
                refreshCountdown={
                  sceneActive && activeProvider ? quoteRefreshCountdown : null
                }
              />
            </View>

            {showClosedMarketTip ? (
              <MarketClosedTip />
            ) : noQuote ? (
              <Text style={styles.errorTip}>
                {t('page.swap.no-quote-found')}
              </Text>
            ) : null}

            {!showTwoStepApproveProgress ? (
              <View style={styles.previewInfoBleed}>{swapPreviewInfo}</View>
            ) : (
              <View style={styles.twoStepApproveSection}>
                <ApprovePendingTxItem
                  type="approveSwap"
                  isForMultipleAddress={isForMultipleAddress}
                  address={currentAccount!.address}
                  hash={approveHash}
                  chainId={currentTxs![0]!.chainId}
                  showHeaderDivider={false}
                  showFooterDivider
                />
                <View style={styles.previewInfoBleed}>{swapPreviewInfo}</View>
              </View>
            )}

            <SwapPendingTransactionsController
              ref={pendingTransactionsRef}
              disableHeaderRight={disableHeaderRight}
              enabled={sceneActive}
              isForMultipleAddress={isForMultipleAddress}
              showPendingTransaction={showPendingSwapProgress}
              onProgressChange={setHasSwapProgress}
            />

            {!isSupportedChain ? (
              <>
                <ExternalSwapBridgeDappTips
                  dappsAvailable={externalDapps.length > 0}
                />
                <SwapBridgeDappPopup
                  visible={swapDappOpen}
                  onClose={() => {
                    setSwapDappOpen(false);
                  }}
                  dappList={externalDapps}
                  openTab={openTab}
                />
              </>
            ) : null}
          </View>
        </KeyboardAwareScrollView>
        <View
          style={[
            styles.buttonContainer,
            {
              paddingBottom:
                BOTTOM_BUTTON_BOTTOM_OFFSET + (isAndroid ? safeOffBottom : 0),
            },
          ]}>
          <Tip
            content={
              !isSupportedChain && externalDapps.length < 1
                ? t('component.externalSwapBrideDappPopup.noDapps')
                : undefined
            }>
            <View>
              {showRiskConfirm ? (
                <SignRiskWarning
                  checked={riskChecked}
                  onToggle={() => setRiskChecked(checked => !checked)}
                />
              ) : null}
              {canShowDirectSubmit ? (
                <DirectSignBtn
                  ref={directSignBtnRef}
                  // refresh  risk check
                  key={`${refreshId}-${chain}-${payToken?.id}-${receiveToken?.id}-${payAmount}-${activeProvider?.quote?.tx?.data}-${isApprove}`}
                  height={BOTTOM_BUTTON_HEIGHT}
                  titleStyle={styles.bottomButtonTitle}
                  loading={miniSignLoading}
                  loadingType="circle"
                  showTextOnLoading
                  authTitle={t('page.whitelist.confirmPassword')}
                  title={btnText}
                  onFinished={() => handleSwap({ ignoreGasFee: riskChecked })}
                  disabled={
                    swapBtnDisabled ||
                    !canDirectSign ||
                    miniSignLoading ||
                    approveTxPending ||
                    riskConfirmDisabled
                  }
                  type={'primary'}
                  syncUnlockTime
                  onBeforeAuth={() => {
                    clearExpiredTimer();
                    formValuesRef.current.save(buildFormSnapshot());
                  }}
                  onCancel={() => {
                    formValuesRef.current.clear();
                    refresh(e => e + 1);
                  }}
                  onAuthModalDismiss={() => {
                    formValuesRef.current.clear();
                  }}
                  account={currentAccount}
                  showHardWalletProcess
                />
              ) : (
                <Button
                  height={BOTTOM_BUTTON_HEIGHT}
                  titleStyle={styles.bottomButtonTitle}
                  onPress={() => {
                    if (!isSupportedChain && !externalDapps.length) {
                      return;
                    }
                    if (!isSupportedChain && externalDapps.length > 0) {
                      setSwapDappOpen(true);
                      return;
                    }
                    if (!activeProvider || slippageChanged) {
                      refresh(e => e + 1);

                      return;
                    }
                    if (activeProvider?.shouldTwoStepApprove) {
                      setTwoStepApproveModalVisible(true);
                      return;
                    }
                    // gotoSwap();
                    handleSwap({ ignoreGasFee: riskChecked });
                  }}
                  title={btnText}
                  disabled={
                    isSupportedChain
                      ? swapBtnDisabled || riskConfirmDisabled
                      : externalDapps.length > 0
                      ? riskConfirmDisabled
                      : true
                  }
                />
              )}
            </View>
          </Tip>
        </View>
        <TwpStepApproveModal
          open={twoStepApproveModalVisible}
          onCancel={() => {
            setTwoStepApproveModalVisible(false);
          }}
          onConfirm={() => handleSwap({ ignoreGasFee: riskChecked })}
        />

        {userAddress && payToken && receiveToken && chain ? (
          <QuoteList
            list={quoteList}
            loading={quoteLoading}
            visible={quotesListVisible}
            onClose={closeQuotesList}
            userAddress={userAddress}
            chain={chain}
            slippage={slippage}
            payToken={payToken}
            payAmount={payAmount}
            receiveToken={receiveToken}
            fee={feeRate}
            inSufficient={inSufficient}
            setActiveProvider={setActiveProvider}
            currentProvider={activeProvider}
            sortIncludeGasFee
          />
        ) : null}
        <RabbyFeePopup
          type="swap"
          visible={isShowRabbyFeePopup}
          dexName={dexName}
          dexFeeDesc={dexFeeDesc}
          onClose={() => setIsShowRabbyFeePopup({ visible: false })}
        />

        <LowCreditModal
          token={lowCreditToken}
          visible={lowCreditVisible}
          onCancel={() => setLowCreditVisible(false)}
        />
      </NormalScreenContainer2024>
    </SignatureInstanceProvider>
  );
};

Swap.SwapHeader = SwapHeader;

const ForMultipleAddress = (
  props: Omit<
    React.ComponentProps<typeof Swap>,
    keyof PropsForAccountSwitchScreen
  >,
) => {
  const { sceneCurrentAccountDepKey } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });
  return (
    <ScreenSceneAccountProvider
      value={{
        forScene: 'MakeTransactionAbout',
        ofScreen: 'MultiSwapBridge',
        sceneScreenRenderId: `${sceneCurrentAccountDepKey}-MultiSwapBridge`,
      }}>
      <Swap {...props} isForMultipleAddress />
    </ScreenSceneAccountProvider>
  );
};

Swap.ForMultipleAddress = ForMultipleAddress;

const getStyle = createGetStyles2024(({ colors2024, isLight }) => ({
  container: {
    flex: 1,
  },
  content: {
    minHeight: 300,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    paddingBottom: 30,
  },
  label: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  labelWithBottomSpacing: {
    marginBottom: 12,
  },
  previewInfoBleed: {
    marginHorizontal: -24,
  },
  twoStepApproveSection: {
    marginTop: 16,
  },
  chainArrowIconContainer: {
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 100,
    backgroundColor: isLight
      ? 'rgba(0, 0, 0, 0.1)'
      : colors2024['neutral-line'],
  },
  balanceText: {
    color: colors2024['neutral-foot'],
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
  },
  errorTip: {
    marginTop: 16,
    color: colors2024['red-default'],
    fontFamily: 'SF Pro Rounded',
    fontSize: 14,
  },
  rowView: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  swapContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 16,
    marginBottom: 12,
  },
  flex1: {
    width: 128,
  },
  swapTokenContainer: {
    position: 'relative',
    gap: 10,
  },
  swapTokenCard: {
    borderRadius: 16,
    backgroundColor: colors2024['neutral-bg-2'],
    overflow: 'hidden',
  },
  arrowWrapper: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    zIndex: 1,
    transform: [{ translateX: -18 }, { translateY: -18 }],
  },
  amountInContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 20,
    marginBottom: 8,
    justifyContent: 'space-between',
  },

  inputContainer: {
    flexDirection: 'column',
    height: 98,
    paddingLeft: 13,
    paddingTop: 4,
    paddingBottom: 16,
    borderRadius: 30,
    justifyContent: 'space-between',
    backgroundColor: colors2024['neutral-bg-2'],
  },
  inputWrapper: {
    height: 60,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 0,
  },
  input: {
    flex: 1,
    fontSize: 28,
    lineHeight: 36,
    paddingVertical: 0,
    paddingBottom: 0,
    textAlignVertical: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  inputUsdValue: {
    fontSize: 14,
    lineHeight: 18,
    height: 18,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-info'],
  },
  loadingQuoteContainer: {
    borderWidth: 1,
    paddingBottom: 16,
    borderColor: colors2024['neutral-line'],
    borderRadius: 24,
    marginTop: 24,
    backgroundColor: colors2024['neutral-bg-1'],
  },

  afterWrapper: {
    marginTop: 20,
    gap: 20,
  },
  afterLabel: {
    fontSize: 14,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-body'],
  },
  afterValue: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'SF Pro Rounded',
    color: colors2024['neutral-title-1'],
  },
  inSufficient: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 26,
    marginHorizontal: 20,
  },
  inSufficientText: {
    color: colors2024['red-default'],
    fontSize: 15,
    fontWeight: '500',
  },

  buttonContainer: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    paddingHorizontal: BOTTOM_BUTTON_HORIZONTAL_PADDING,
    backgroundColor: colors2024['neutral-bg-1'],
    width: '100%',
  },
  bottomButtonTitle: {
    fontSize: BOTTOM_BUTTON_TITLE_FONT_SIZE,
  },
  approveContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  approveSwitchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unlimitedText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors2024['neutral-foot'],
  },
  maxBtn: {
    marginLeft: 12,
    padding: 4,
    backgroundColor: colors2024['brand-light-1'],
    borderRadius: 8,
  },
  maxButtonText: {
    color: colors2024['brand-default'],
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
    fontFamily: 'SF Pro Rounded',
  },
}));

export default Swap;
