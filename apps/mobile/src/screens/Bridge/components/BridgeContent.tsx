import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { View, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import NormalScreenContainer from '@/components/ScreenContainer/NormalScreenContainer';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import {
  useQuoteVisible,
  useRefreshId,
  useSetQuoteVisible,
  useSetRefreshId,
  useSetSettingVisible,
} from '../hooks';
import { useTranslation } from 'react-i18next';
import { TwpStepApproveModal } from '@/screens/Swap/components/TwoStepApproveModal';
import BigNumber from 'bignumber.js';
import { QuoteList } from './BridgeQuotes';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { openapi } from '@/core/request';
import pRetry from 'p-retry';
import { stats } from '@/utils/stats';
import { bridgeToken, buildBridgeToken } from '../hooks/bridge';
import { toast } from '@/components2024/Toast';
import { useMemoizedFn, useRequest } from 'ahooks';
import { useRoute } from '@react-navigation/native';
import { AccountSwitcherModal } from '@/components/AccountSwitcher/Modal';
import BridgeToken from './BridgeToken';
import BridgeSwitchBtn from './BridgeSwitchBtn';
import { findChainByEnum, findChainByServerID } from '@/utils/chain';
import BridgeShowMore, { RecommendFromToken } from './BridgeShowMore';
import { tokenPriceImpact, useBridge } from '../hooks/token';
import { Button } from '@/components2024/Button';
import { SignRiskWarning } from '@/components/SignRiskWarning';

import {
  type TokenItemMaybeWithOwner,
  useSwitchSceneAccountOnSelectedTokenWithOwner,
} from '@/databases/hooks/token';
import { CHAINS_ENUM } from '@debank/common';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { useExternalSwapBridgeDapps } from '@/components/ExternalSwapBridgeDappPopup/hook';
import {
  ExternalSwapBridgeDappTips,
  SwapBridgeDappPopup,
} from '@/components/ExternalSwapBridgeDappPopup';
import { Tip } from '@/components';
import { useSceneAccountInfo } from '@/hooks/accountsSwitcher';
import { isAccountSupportMiniApproval } from '@/utils/account';
import { BridgePendingTxItem } from './PendingTxItem';
import { last } from 'lodash';
import { transactionHistoryServiceApi } from '@/core/serviceApi/transactionHistory';
import type { BridgeTxHistoryItem } from '@/core/services/transactionHistory';
import { safeGetOrigin } from '@rabby-wallet/base-utils/dist/isomorphic/url';
import { matomoRequestEvent } from '@/utils/analytics';
import type { DirectSignBtnMethods } from '@/components2024/DirectSignBtn';
import { DirectSignBtn } from '@/components2024/DirectSignBtn';
import { useMiniSigner } from '@/hooks/useSigner';
import { MINI_SIGN_ERROR } from '@/components2024/MiniSignV2/state/SignatureManager';
import { SignatureInstanceProvider } from '@/components2024/MiniSignV2/state/SignatureInstanceContext';
import { useSignatureStoreOf } from '@/components2024/MiniSignV2/state/useSignatureStore';
import {
  canProcessSignature,
  isSignatureGasFeeTooHigh,
  selectSignatureGuardFlags,
} from '@/components2024/MiniSignV2/state/signatureGuardFlags';
import { buildFingerprint } from '@/components2024/MiniSignV2/domain/ctx';
import { BridgeSlippage } from './BridgeSlippage';
import { Text } from '@/components/Typography';
import { MarketClosedTip } from '@/components/Token/MarketClosedTip';
import { storeApiExpSettingData } from '@/hooks/appSettings';
import type { FormAmountMode } from '@/utils/form';
import {
  FormValuesOnSubmit,
  createAmountComparer,
  shouldIgnoreAmountChangeInMaxMode,
} from '@/utils/form';
import { tokenAmountBn } from '@/screens/Swap/utils';
import { buildTx as buildBridgeTx } from '@rabby-wallet/rabby-bridge';
import { useMiniSignerEffectPause } from '@/hooks/useMiniSignerEffectPause';
import {
  hasQuotePollingPauseReason,
  type QuotePollingPauseReasonState,
  updateQuotePollingPauseReason,
} from '@/utils/quotePolling';
import { IS_ANDROID } from '@/core/native/utils';
import {
  ensureFeatureActivation,
  markFeatureActivation,
} from '@/core/utils/featureActivationDiagnostics';
import { useRegressionScenario } from '@/devtools/regressionScenarios/react';
import { RootNames } from '@/constant/layout';
import type { GetNestedScreenRouteProp } from '@/navigation-type';
import {
  BridgePendingTransactionsController,
  type BridgePendingTransactionsControllerRef,
} from './BridgePendingTransactionsController';

/** Bridge form snapshot for validation during auth */
export interface BridgeFormSnapshot {
  amount: string;
  amountMode?: FormAmountMode;
}

function BridgeActivationDataProbe({
  currentAddress,
  fromChainReady,
  fromTokenChain,
  fromTokenId,
  toChainReady,
  toTokenChain,
  toTokenId,
}: {
  currentAddress?: string;
  fromChainReady: boolean;
  fromTokenChain?: string;
  fromTokenId?: string;
  toChainReady: boolean;
  toTokenChain?: string;
  toTokenId?: string;
}) {
  useEffect(() => {
    if (
      !currentAddress ||
      !fromChainReady ||
      !fromTokenId ||
      !toChainReady ||
      !toTokenId
    ) {
      return;
    }

    const cycleId = ensureFeatureActivation('bridge', 'bridge_data_probe');
    markFeatureActivation('bridge', 'data-ready', {
      cycleId,
      reason: 'bridge_token_pair_ready',
      detail: `${fromTokenChain}:${fromTokenId}->${toTokenChain}:${toTokenId}`,
    });
  }, [
    currentAddress,
    fromChainReady,
    fromTokenChain,
    fromTokenId,
    toChainReady,
    toTokenChain,
    toTokenId,
  ]);

  return null;
}

const BOTTOM_BUTTON_HEIGHT = 52;
const BOTTOM_BUTTON_TITLE_FONT_SIZE = 18;
const BOTTOM_BUTTON_HORIZONTAL_PADDING = 20;
const BOTTOM_BUTTON_BOTTOM_OFFSET = 36;
const BUILD_BRIDGE_TXS_DEBOUNCE_MS = 500;
const DEFAULT_REGRESSION_TARGET_USD = '0.1';
const DEFAULT_REGRESSION_MAX_TOTAL_USD = '1';

function readRegressionUsdParam(value: string | undefined, fallback: string) {
  const parsed = new BigNumber(value || fallback);
  if (!parsed.isFinite() || !parsed.gt(0)) {
    return new BigNumber(fallback);
  }
  return parsed;
}

function isSameAmountValue(left: string | number, right: BigNumber) {
  return new BigNumber(left || 0).eq(right);
}

function normalizeRegressionTokenId(tokenId?: string | null) {
  return (tokenId || '').toLowerCase();
}

function isSameRegressionTokenId(left?: string | null, right?: string | null) {
  return (
    !!left &&
    !!right &&
    normalizeRegressionTokenId(left) === normalizeRegressionTokenId(right)
  );
}

const getStyle = createGetStyles2024(({ colors2024, colors }) => ({
  screen: {
    backgroundColor: colors2024['neutral-bg-1'],
    overflow: 'visible',
  },
  container: {
    flex: 1,
    paddingTop: 16,
    overflow: 'visible',
  },
  noRecoomedTokenText: {
    fontSize: 14,
    fontFamily: 'SF Pro Rounded',
    color: colors2024['red-default'],
    fontWeight: '500',
    marginHorizontal: 24,
  },
  cardContainer: {
    position: 'relative',
    flexDirection: 'column',
    // marginHorizontal: 20,
    gap: 8,
    marginBottom: -8,
    // width: '100%',
    // flex: 1,
  },
  switchButtonContainer: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: [{ translateX: -18 }, { translateY: -18 }],
  },
  switchButton: {
    padding: 10,
    backgroundColor: '#007bff',
    borderRadius: 5,
    alignItems: 'center',
  },
  innerContainer: {
    flex: 1,
  },
  pb130: {
    paddingBottom: 130,
  },
  pb110: {
    paddingBottom: 110,
  },
  card: {
    // backgroundColor: colors['neutral-card-1'],
    borderRadius: 6,
    padding: 12,
    paddingTop: 0,
    marginHorizontal: 10,
  },
  subTitle: {
    fontSize: 14,
    color: colors['neutral-body'],
    marginTop: 16,
    marginBottom: 8,
  },
  chainSelector: {
    height: 52,
    fontSize: 16,
    fontWeight: '500',
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipsContainer: {
    justifyContent: 'space-between',
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hidden: {
    display: 'none',
  },
  maxBtn: {
    marginLeft: 6,
    marginTop: 16,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors['neutral-line'],
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  input: {
    paddingRight: 10,
    fontSize: 20,
    fontWeight: '600',
    position: 'relative',
    flex: 1,
    color: colors['neutral-title-1'],
    backgroundColor: 'transparent',
  },
  inputUsdValue: {
    fontSize: 12,
    fontWeight: '400',
    color: colors['neutral-foot'],
  },
  buttonContainer: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    backgroundColor: colors2024['neutral-bg-1'],
    width: '100%',
    paddingHorizontal: BOTTOM_BUTTON_HORIZONTAL_PADDING,
  },
  btnTitle: {
    color: colors['neutral-title-2'],
  },
  bottomButtonTitle: {
    fontSize: BOTTOM_BUTTON_TITLE_FONT_SIZE,
  },
  marketClosedTip: {
    marginHorizontal: 24,
  },
}));

export const BridgeContent = ({
  isForMultipleAddress = false,
  disableHeaderRight = false,
  disableAccountSwitcherModal = false,
  diagnosticActive = false,
  sceneActive = true,
}: {
  isForMultipleAddress?: boolean;
  disableHeaderRight?: boolean;
  disableAccountSwitcherModal?: boolean;
  diagnosticActive?: boolean;
  sceneActive?: boolean;
}) => {
  const { t } = useTranslation();
  const { bottom } = useSafeAreaInsets();
  const { styles } = useTheme2024({ getStyle });
  const pendingTransactionsRef =
    useRef<BridgePendingTransactionsControllerRef>(null);

  const [twoStepApproveModalVisible, setTwoStepApproveModalVisible] =
    useState(false);

  const { finalSceneCurrentAccount: currentAccount } = useSceneAccountInfo({
    forScene: 'MakeTransactionAbout',
  });

  // Form values snapshot for validation before auth submission
  const formValuesRef = useRef(
    new FormValuesOnSubmit<BridgeFormSnapshot>({
      comparers: {
        amount: createAmountComparer(),
      },
    }),
  );

  const quoteVisible = useQuoteVisible();

  const setQuoteVisible = useSetQuoteVisible();
  const regressionScenario = useRegressionScenario<'SwapBridge'>();
  const regressionScenarioActive = regressionScenario.active;
  const regressionScenarioId = regressionScenario.active
    ? regressionScenario.scenario
    : null;
  const regressionScenarioTab = regressionScenario.active
    ? regressionScenario.params.tab
    : null;
  const bridgeFundedAmountAppliedRunIdRef = useRef('');
  const route =
    useRoute<
      GetNestedScreenRouteProp<
        'TransactionNavigatorParamList',
        typeof RootNames.SwapBridge | typeof RootNames.MultiSwapBridge
      >
    >();

  const {
    fromChain,
    fromToken,
    setFromToken,
    switchFromChain,
    toChain,
    toToken,
    setToToken,
    switchToChain: setToChain,
    switchToken,
    amount,
    handleAmountChange,
    feeRate,

    recommendFromToken,
    fillRecommendFromToken,

    inSufficient,

    openQuotesList,
    quoteLoading: originQuoteLoading,
    allQuotesLoaded,
    quoteRequestId,
    quoteList,
    setQuotesList,

    bestQuoteId,
    selectedBridgeQuote,

    setSelectedBridgeQuote,

    slippage,
    slippageState,
    setSlippage,
    setSlippageChanged,
    isSlippageHigh,
    isSlippageLow,

    autoSlippage,
    isCustomSlippage,
    setAutoSlippage,
    setIsCustomSlippage,

    clearExpiredTimer,
    setAutoQuoteRefreshPaused,
    setReloadTxRefreshPaused,
    quoteRefreshCountdown,

    gasList,
    passGasPrice,
    handleMax,
    clickMaxBtnCount,
    isMaxRef,
    payTokenIsNativeToken,
    inSufficientCanGetQuote,
    quoteBlockedByClosedMarket,
    slider,
    onChangeSlider,
  } = useBridge(isForMultipleAddress, { active: sceneActive });

  const isRegressionBridgePairMatched = useMemo(() => {
    const params = route.params;
    if (
      !regressionScenarioActive ||
      regressionScenarioId !== 'swap-bridge' ||
      regressionScenarioTab !== 'bridge' ||
      !params?.chainEnum ||
      !params.tokenId ||
      !params.toChainEnum ||
      !params.toTokenId ||
      !fromToken ||
      !toToken
    ) {
      return false;
    }

    const expectedFromChain = findChainByEnum(params.chainEnum)?.serverId;
    const expectedToChain = findChainByEnum(params.toChainEnum)?.serverId;

    return (
      !!expectedFromChain &&
      !!expectedToChain &&
      fromToken.chain === expectedFromChain &&
      toToken.chain === expectedToChain &&
      isSameRegressionTokenId(fromToken.id, params.tokenId) &&
      isSameRegressionTokenId(toToken.id, params.toTokenId)
    );
  }, [
    fromToken,
    regressionScenarioActive,
    regressionScenarioId,
    regressionScenarioTab,
    route.params,
    toToken,
  ]);

  useEffect(() => {
    if (
      !sceneActive ||
      !regressionScenario.active ||
      regressionScenario.scenario !== 'swap-bridge' ||
      regressionScenario.params.tab !== 'bridge' ||
      !isRegressionBridgePairMatched ||
      !fromToken ||
      !toToken
    ) {
      return;
    }

    const price = new BigNumber(fromToken.price || 0);
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
    const amountValue = targetUsd
      .div(price)
      .decimalPlaces(Math.min(fromToken.decimals || 6, 6), BigNumber.ROUND_UP);
    const actualUsd = amountValue.times(price);
    const balance = tokenAmountBn(fromToken);

    if (
      !amountValue.gt(0) ||
      actualUsd.gt(maxTotalUsd) ||
      !balance.gt(amountValue)
    ) {
      if (regressionScenario.claimOnce('bridge-funded-amount-invalid')) {
        regressionScenario.report('assertion', {
          assertion: 'bridge-funded-amount-valid',
          passed: false,
          fromChain: fromToken.chain,
          fromToken: fromToken.symbol,
          toChain: toToken.chain,
          toToken: toToken.symbol,
          targetUsd: targetUsd.toString(10),
          actualUsd: actualUsd.toString(10),
          balance: balance.toString(10),
        });
      }
      return;
    }

    if (!isSameAmountValue(amount, amountValue)) {
      const hasApplied =
        bridgeFundedAmountAppliedRunIdRef.current === regressionScenario.runId;
      const assertion = hasApplied
        ? 'bridge-funded-amount-reapplied'
        : 'bridge-funded-amount-applied';
      handleAmountChange(amountValue.toString(10));
      if (!hasApplied || regressionScenario.claimOnce(assertion)) {
        regressionScenario.report('assertion', {
          assertion,
          passed: true,
          mode: 'dry-run',
          fromChain: fromToken.chain,
          fromToken: fromToken.symbol,
          toChain: toToken.chain,
          toToken: toToken.symbol,
          amount: amountValue.toString(10),
          targetUsd: targetUsd.toString(10),
          actualUsd: actualUsd.toString(10),
        });
      }
      bridgeFundedAmountAppliedRunIdRef.current = regressionScenario.runId;
      return;
    }

    if (regressionScenario.claimOnce('bridge-funded-form-amount-ready')) {
      regressionScenario.report('assertion', {
        assertion: 'bridge-funded-form-amount-ready',
        passed: true,
        mode: 'dry-run',
        fromChain: fromToken.chain,
        fromToken: fromToken.symbol,
        toChain: toToken.chain,
        toToken: toToken.symbol,
        amount,
        targetUsd: targetUsd.toString(10),
        actualUsd: actualUsd.toString(10),
      });
    }
  }, [
    amount,
    fromToken,
    handleAmountChange,
    isRegressionBridgePairMatched,
    regressionScenario,
    sceneActive,
    toToken,
  ]);

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

  const chains = useMemo(
    () => [toChain, fromChain].filter(e => !!e) as CHAINS_ENUM[],
    [toChain, fromChain],
  );

  const {
    isSupportedChain,
    data: externalDapps,
    loading: externalDappsLoading,
    openTab: _openTab,
  } = useExternalSwapBridgeDapps(chains, 'bridge', sceneActive);
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
  const [externalDappOpen, setExternalDappOpen] = useState(false);

  const showExternalDappTips = useMemo(
    () => !isSupportedChain && !!fromChain && !!toChain,
    [isSupportedChain, fromChain, toChain],
  );

  const refresh = useSetRefreshId();
  const refreshId = useRefreshId();

  const [fetchingBridgeQuote, setFetchingBridgeQuote] = useState(false);

  const gotoBridge = useMemoizedFn(async () => {
    if (
      !inSufficient &&
      fromToken &&
      toToken &&
      selectedBridgeQuote?.bridge_id &&
      currentAccount?.address
    ) {
      try {
        setReloadTxRefreshPaused(true);
        setFetchingBridgeQuote(true);
        const tx = await pRetry(
          () =>
            buildBridgeTx(
              selectedBridgeQuote.aggregator.id,
              {
                bridgeId: selectedBridgeQuote.bridge_id,
                userAddress: currentAccount?.address,
                fromChainId: fromToken.chain,
                fromTokenId: fromToken.id,
                fromTokenRawAmount: new BigNumber(amount)
                  .times(10 ** fromToken.decimals)
                  .toFixed(0, 1)
                  .toString(),
                toChainId: toToken.chain,
                toTokenId: toToken.id,
                slippage: new BigNumber(slippageState).div(100).toString(10),
                quoteKey: selectedBridgeQuote.quote_key || {},
              },
              openapi,
            ),
          { retries: 1 },
        );
        stats.report('bridgeQuoteResult', {
          aggregatorIds: selectedBridgeQuote.aggregator.id,
          bridgeId: selectedBridgeQuote.bridge_id,
          fromChainId: fromToken.chain,
          fromTokenId: fromToken.id,
          toTokenId: toToken.id,
          toChainId: toToken.chain,
          status: tx ? 'success' : 'fail',
          payAmount: amount,
        });
        const addBridgeTxHistoryObj = {
          address: currentAccount?.address!,
          fromChainId: findChainByServerID(fromToken?.chain || '')?.id || 0,
          toChainId: findChainByServerID(toToken?.chain || '')?.id || 0,
          fromToken: fromToken!,
          toToken: toToken!,
          slippage: new BigNumber(slippage).div(100).toNumber(),
          fromAmount: Number(amount),
          toAmount: Number(selectedBridgeQuote?.to_token_amount || 0),
          dexId: selectedBridgeQuote?.aggregator.id!,
          createdAt: Date.now(),
          status: 'pending' as BridgeTxHistoryItem['status'],
          estimatedDuration: selectedBridgeQuote.duration,
        };
        await bridgeToken(
          {
            approveId: selectedBridgeQuote.approve_contract_id,
            to: tx.to,
            value: tx.value,
            data: tx.data,
            payTokenRawAmount: new BigNumber(amount)
              .times(10 ** fromToken.decimals)
              .toFixed(0, 1)
              .toString(),
            chainId: tx.chainId,
            shouldApprove: !!selectedBridgeQuote.shouldApproveToken,
            shouldTwoStepApprove: !!selectedBridgeQuote.shouldTwoStepApprove,
            gasPrice:
              payTokenIsNativeToken && passGasPrice
                ? gasList?.find(e => e.level === 'normal')?.price
                : undefined,
            payTokenId: fromToken.id,
            payTokenChainServerId: fromToken.chain,
            info: {
              aggregator_id: selectedBridgeQuote.aggregator.id,
              bridge_id: selectedBridgeQuote.bridge_id,
              from_chain_id: fromToken.chain,
              from_token_id: fromToken.id,
              from_token_amount: amount,
              to_chain_id: toToken.chain,
              to_token_id: toToken.id,
              to_token_amount: selectedBridgeQuote.to_token_amount,
              tx: tx,
              rabby_fee: selectedBridgeQuote.rabby_fee.usd_value,
              fee_rate: Number(feeRate),
              slippage: new BigNumber(slippage).div(100).toNumber(),
            },
            account: currentAccount,
          },
          {
            ga: {
              category: 'Bridge',
              source: 'bridge',
              trigger: 'bridge',
            },
          },
          addBridgeTxHistoryObj,
        );
        pendingTransactionsRef.current?.refreshLocal();
        handleAmountChange('');
        setTimeout(() => {
          pendingTransactionsRef.current?.refreshRemote();
        }, 500);
      } catch (error) {
        toast.info((error as any)?.message || String(error));
        setQuotesList(pre =>
          pre?.filter(
            item =>
              !(
                item?.aggregator?.id === selectedBridgeQuote?.aggregator?.id &&
                item?.bridge_id === selectedBridgeQuote?.bridge_id
              ),
          ),
        );
        stats.report('bridgeQuoteResult', {
          aggregatorIds: selectedBridgeQuote.aggregator.id,
          bridgeId: selectedBridgeQuote.bridge_id,
          fromChainId: fromToken.chain,
          fromTokenId: fromToken.id,
          toTokenId: toToken.id,
          toChainId: toToken.chain,
          status: 'fail',
          payAmount: amount,
        });
        console.log(error);
      } finally {
        setReloadTxRefreshPaused(false);
        refresh(e => e + 1);
        setFetchingBridgeQuote(false);
      }
    }
  });

  const selectedBridgeQuoteBuildKey = useMemo(() => {
    if (!selectedBridgeQuote || !fromToken || !toToken) {
      return '';
    }

    const gasPrice =
      payTokenIsNativeToken && passGasPrice
        ? gasList?.find(e => e.level === 'normal')?.price
        : '';

    return [
      fromToken.chain,
      fromToken.id,
      toToken.chain,
      toToken.id,
      amount,
      feeRate,
      slippageState,
      selectedBridgeQuote.aggregator.id,
      selectedBridgeQuote.bridge_id,
      selectedBridgeQuote.shouldApproveToken ? '1' : '0',
      selectedBridgeQuote.shouldTwoStepApprove ? '1' : '0',
      selectedBridgeQuote.to_token_amount,
      selectedBridgeQuote.approve_contract_id || '',
      selectedBridgeQuote.tx?.to || '',
      selectedBridgeQuote.tx?.value || '',
      selectedBridgeQuote.tx?.data || '',
      JSON.stringify(selectedBridgeQuote.quote_key || {}),
      gasPrice || '',
    ].join('|');
  }, [
    amount,
    feeRate,
    fromToken,
    gasList,
    passGasPrice,
    payTokenIsNativeToken,
    selectedBridgeQuote,
    slippageState,
    toToken,
  ]);
  const selectedBridgeQuoteBuildKeyRef = useRef(selectedBridgeQuoteBuildKey);

  useEffect(() => {
    selectedBridgeQuoteBuildKeyRef.current = selectedBridgeQuoteBuildKey;
  }, [selectedBridgeQuoteBuildKey]);

  const selectedBridgeQuoteIsBestQuote =
    !!bestQuoteId &&
    !!selectedBridgeQuote &&
    bestQuoteId.aggregatorId === selectedBridgeQuote.aggregator.id &&
    bestQuoteId.bridgeId === selectedBridgeQuote.bridge_id;
  const selectedBridgeQuoteIsManualQuote = !!selectedBridgeQuote?.manualClick;
  const selectedBridgeQuoteCanAutoPreExec =
    selectedBridgeQuoteIsBestQuote || selectedBridgeQuoteIsManualQuote;
  const builtBridgeTxsKeyRef = useRef('');
  const prefetchedBridgeTxsKeyRef = useRef('');

  const buildTxs = useMemoizedFn(async (expectedBuildKey?: string) => {
    if (
      !inSufficient &&
      fromToken &&
      toToken &&
      selectedBridgeQuote?.bridge_id &&
      currentAccount?.address
    ) {
      const buildKey =
        expectedBuildKey || selectedBridgeQuoteBuildKeyRef.current;
      if (
        expectedBuildKey &&
        buildKey !== selectedBridgeQuoteBuildKeyRef.current
      ) {
        return;
      }

      try {
        const tx = await buildBridgeTx(
          selectedBridgeQuote.aggregator.id,
          {
            bridgeId: selectedBridgeQuote.bridge_id,
            userAddress: currentAccount?.address,
            fromChainId: fromToken.chain,
            fromTokenId: fromToken.id,
            fromTokenRawAmount: new BigNumber(amount)
              .times(10 ** fromToken.decimals)
              .toFixed(0, 1)
              .toString(),
            toChainId: toToken.chain,
            toTokenId: toToken.id,
            slippage: new BigNumber(slippageState).div(100).toString(10),
            quoteKey: selectedBridgeQuote.quote_key || {},
          },
          openapi,
        );
        stats.report('bridgeQuoteResult', {
          aggregatorIds: selectedBridgeQuote.aggregator.id,
          bridgeId: selectedBridgeQuote.bridge_id,
          fromChainId: fromToken.chain,
          fromTokenId: fromToken.id,
          toTokenId: toToken.id,
          toChainId: toToken.chain,
          status: tx ? 'success' : 'fail',
          payAmount: amount,
        });

        if (
          expectedBuildKey &&
          buildKey !== selectedBridgeQuoteBuildKeyRef.current
        ) {
          return;
        }

        const result = await buildBridgeToken(
          {
            approveId: selectedBridgeQuote.approve_contract_id,
            to: tx.to,
            value: tx.value,
            data: tx.data,
            payTokenRawAmount: new BigNumber(amount)
              .times(10 ** fromToken.decimals)
              .toFixed(0, 1)
              .toString(),
            chainId: tx.chainId,
            shouldApprove: !!selectedBridgeQuote.shouldApproveToken,
            shouldTwoStepApprove: !!selectedBridgeQuote.shouldTwoStepApprove,
            gasPrice:
              payTokenIsNativeToken && passGasPrice
                ? gasList?.find(e => e.level === 'normal')?.price
                : undefined,
            payTokenId: fromToken.id,
            payTokenChainServerId: fromToken.chain,
            info: {
              aggregator_id: selectedBridgeQuote.aggregator.id,
              bridge_id: selectedBridgeQuote.bridge_id,
              from_chain_id: fromToken.chain,
              from_token_id: fromToken.id,
              from_token_amount: amount,
              to_chain_id: toToken.chain,
              to_token_id: toToken.id,
              to_token_amount: selectedBridgeQuote.to_token_amount,
              tx: tx,
              rabby_fee: selectedBridgeQuote.rabby_fee.usd_value,
              fee_rate: Number(feeRate),
              slippage: new BigNumber(slippageState).div(100).toNumber(),
            },
            account: currentAccount,
          },
          {
            ga: {
              category: 'Bridge',
              source: 'bridge',
              trigger: 'bridge',
            },
          },
        );
        if (
          expectedBuildKey &&
          buildKey !== selectedBridgeQuoteBuildKeyRef.current
        ) {
          return;
        }
        builtBridgeTxsKeyRef.current = buildKey;
        return result;
      } catch (error) {
        toast.info((error as any)?.message || String(error));
        setQuotesList(pre =>
          pre?.filter(
            item =>
              !(
                item?.aggregator?.id === selectedBridgeQuote?.aggregator?.id &&
                item?.bridge_id === selectedBridgeQuote?.bridge_id
              ),
          ),
        );
        stats.report('bridgeQuoteResult', {
          aggregatorIds: selectedBridgeQuote.aggregator.id,
          bridgeId: selectedBridgeQuote.bridge_id,
          fromChainId: fromToken.chain,
          fromTokenId: fromToken.id,
          toTokenId: toToken.id,
          toChainId: toToken.chain,
          status: 'fail',
          payAmount: amount,
        });
        console.debug(error);
      }
    }
  });

  const {
    data: txs,
    runAsync: runBuildTxs,
    mutate: mutateTxs,
    loading: buildingTxsLoading,
  } = useRequest(buildTxs, {
    manual: true,
  });

  const runBuildBridgeTxsRef = useRef<
    ReturnType<typeof runBuildTxs> | undefined
  >(undefined);
  const runBuildBridgeTxsKeyRef = useRef('');
  const buildBridgeTxsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const bridgeAutoPreExecRef = useRef({
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
    bridgeAutoPreExecRef.current = {
      requestId: quoteRequestId,
      earlyBuildKey: '',
      finalBuildKey: '',
      manualBuildKey: '',
    };
    builtBridgeTxsKeyRef.current = '';
    prefetchedBridgeTxsKeyRef.current = '';
    mutateTxs([]);
    runBuildBridgeTxsRef.current = undefined;
    runBuildBridgeTxsKeyRef.current = '';
    if (buildBridgeTxsTimerRef.current) {
      clearTimeout(buildBridgeTxsTimerRef.current);
      buildBridgeTxsTimerRef.current = null;
    }
  }, [mutateTxs, quoteRequestId]);

  const runBuildBridgeTxsForKey = useMemoizedFn((buildKey: string) => {
    const buildPromise = runBuildTxs(buildKey);
    runBuildBridgeTxsRef.current = buildPromise;
    runBuildBridgeTxsKeyRef.current = buildKey;
    buildPromise.finally(() => {
      if (runBuildBridgeTxsRef.current === buildPromise) {
        runBuildBridgeTxsRef.current = undefined;
        runBuildBridgeTxsKeyRef.current = '';
      }
    });
    return buildPromise;
  });

  const canUseMiniTx = isAccountSupportMiniApproval(currentAccount?.type);

  const quoteLoading =
    originQuoteLoading ||
    buildingTxsLoading ||
    (!!selectedBridgeQuote &&
      (canUseMiniTx ? !txs?.length : false) &&
      !inSufficient);

  const canShowDirectSubmit = useMemo(
    () =>
      isAccountSupportMiniApproval(currentAccount?.type) &&
      isSupportedChain &&
      !inSufficient,
    [currentAccount?.type, inSufficient, isSupportedChain],
  );

  const bridgeChainServerId = useMemo(
    () =>
      fromToken?.chain ||
      (fromChain ? findChainByEnum(fromChain)?.serverId : undefined),
    [fromChain, fromToken?.chain],
  );

  const miniSignGa = useMemo(
    () => ({
      category: 'Bridge',
      source: 'bridge',
    }),
    [],
  );

  const {
    prefetch: prefetchMiniSigner,
    openDirect,
    close: closeMiniSigner,
    instance,
  } = useMiniSigner({
    account: currentAccount!,
    chainServerId: bridgeChainServerId,
    autoResetGasStoreOnChainChange: true,
  });

  const signatureGuardFlags = useSignatureStoreOf(
    instance,
    selectSignatureGuardFlags,
  );
  const miniSignGasFeeTooHigh = isSignatureGasFeeTooHigh(signatureGuardFlags);
  const canDirectSign = canProcessSignature(signatureGuardFlags);

  const [miniSignLoading, setMiniSignLoading] = useState(false);
  const shouldPauseMiniSignerEffects =
    useMiniSignerEffectPause(miniSignLoading);

  const directSignBtnRef = useRef<DirectSignBtnMethods>(null);

  const buildFormSnapshot = useCallback(
    (): BridgeFormSnapshot => ({
      amount: amount || '',
      amountMode: slider === 100 ? 'max' : 'exact',
    }),
    [amount, slider],
  );

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
    if (!txs?.length) {
      closeMiniSigner({ preserveManualGasMethod: true });
      return;
    }
    const canPrefetchCurrentTxs =
      selectedBridgeQuoteCanAutoPreExec &&
      !!builtBridgeTxsKeyRef.current &&
      builtBridgeTxsKeyRef.current === selectedBridgeQuoteBuildKeyRef.current;
    if (!canPrefetchCurrentTxs) {
      return;
    }
    const prefetchKey = [
      builtBridgeTxsKeyRef.current,
      buildFingerprint(txs || []),
    ].join('|');
    if (prefetchedBridgeTxsKeyRef.current === prefetchKey) {
      return;
    }
    prefetchedBridgeTxsKeyRef.current = prefetchKey;
    prefetchMiniSigner({
      txs,
      ga: miniSignGa,
      checkGasFeeTooHigh: true,
      synGasHeaderInfo: true,
    }).catch(error => {
      if (prefetchedBridgeTxsKeyRef.current === prefetchKey) {
        prefetchedBridgeTxsKeyRef.current = '';
      }
      console.error('bridge mini signer prefetch failed', error);
    });
  }, [
    canShowDirectSubmit,
    closeMiniSigner,
    currentAccount?.address,
    sceneActive,
    miniSignGa,
    prefetchMiniSigner,
    selectedBridgeQuoteBuildKey,
    selectedBridgeQuoteCanAutoPreExec,
    shouldPauseMiniSignerEffects,
    txs,
  ]);

  useEffect(
    () => () => {
      closeMiniSigner();
    },
    [closeMiniSigner],
  );

  const handleBridge = useMemoizedFn(async (p?: { ignoreGasFee?: boolean }) => {
    if (storeApiExpSettingData.getShouldBlockSubmitIfFormChangedOnAuth()) {
      const snapshot = formValuesRef.current.getSnapshot();

      if (!snapshot) {
        toast.info(t('page.bridge.formChangedAmount'));
        return;
      }

      // Check if amount changed during authentication
      const comparison = formValuesRef.current.compare({
        amount: amount || '',
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
        builtBridgeTxsKeyRef.current = '';
        prefetchedBridgeTxsKeyRef.current = '';
        runBuildBridgeTxsRef.current = undefined;
        runBuildBridgeTxsKeyRef.current = '';
        mutateTxs([]);
        return;
      }
    }

    // Clear snapshot after validation
    formValuesRef.current.clear();

    // // leave here for debug __DEV__ mode: don't actually submit, just console.debug and clear form
    // if (__DEV__) {
    //   console.debug('[Bridge] DEV mode - Skipping actual transaction submission');
    //   console.debug('[Bridge] Amount:', amount);
    //   console.debug('[Bridge] fromToken:', fromToken?.id);
    //   console.debug('[Bridge] toToken:', toToken?.id);

    //   // Still clear the form as if transaction was submitted
    //   handleAmountChange('');
    //   refresh(e => e + 1);
    //   mutateTxs([]);
    //   return;
    // }

    if (canUseMiniTx && canShowDirectSubmit) {
      try {
        if (miniSignLoading) {
          return;
        }
        setReloadTxRefreshPaused(true);
        setMiniSignLoading(true);
        setFetchingBridgeQuote(true);

        clearExpiredTimer();
        if (buildBridgeTxsTimerRef.current) {
          clearTimeout(buildBridgeTxsTimerRef.current);
          buildBridgeTxsTimerRef.current = null;
        }

        const currentBuildKey = selectedBridgeQuoteBuildKeyRef.current;
        const canReuseCurrentTxs =
          !!currentBuildKey &&
          builtBridgeTxsKeyRef.current === currentBuildKey &&
          !!txs?.length;
        let currentTxs = canReuseCurrentTxs ? txs : undefined;
        if (!currentTxs?.length && currentBuildKey) {
          const reusableBuildPromise =
            runBuildBridgeTxsKeyRef.current === currentBuildKey
              ? runBuildBridgeTxsRef.current
              : undefined;
          const buildPromise =
            reusableBuildPromise || runBuildBridgeTxsForKey(currentBuildKey);
          const res = await buildPromise;
          if (res?.length) {
            currentTxs = res;
          }
        }

        if (!currentTxs?.length) {
          toast.info('please retry');
          throw new Error('no txs');
        }

        const res = await openDirect({
          txs: currentTxs,
          ga: miniSignGa,
          checkGasFeeTooHigh: true,
          ignoreGasFeeTooHigh: p?.ignoreGasFee || false,
        });
        const txHash = last(res) || '';

        if (txHash) {
          await transactionHistoryServiceApi.addBridgeTxHistory({
            address: currentAccount?.address!,
            fromChainId: findChainByServerID(fromToken?.chain || '')?.id || 0,
            toChainId: findChainByServerID(toToken?.chain || '')?.id || 0,
            fromToken: fromToken!,
            toToken: toToken!,
            slippage: new BigNumber(slippageState).div(100).toNumber(),
            fromAmount: Number(amount),
            dexId: selectedBridgeQuote?.aggregator.id!,
            toAmount: Number(selectedBridgeQuote?.to_token_amount || 0),
            status: 'pending',
            hash: txHash,
            createdAt: Date.now(),
            estimatedDuration: selectedBridgeQuote?.duration || 0,
          });
        }

        builtBridgeTxsKeyRef.current = '';
        prefetchedBridgeTxsKeyRef.current = '';
        mutateTxs([]);
        pendingTransactionsRef.current?.refreshLocal();
        handleAmountChange('');
        setTimeout(() => {
          pendingTransactionsRef.current?.refreshRemote();
        }, 500);
      } catch (error: any) {
        console.log('bridge mini sign error', error);
        if (error === MINI_SIGN_ERROR.USER_CANCELLED) {
          refresh(e => e + 1);
          builtBridgeTxsKeyRef.current = '';
          prefetchedBridgeTxsKeyRef.current = '';
          mutateTxs([]);
        } else if (
          [
            MINI_SIGN_ERROR.GAS_FEE_TOO_HIGH,
            MINI_SIGN_ERROR.CANT_PROCESS,
          ].includes(error)
        ) {
          setTimeout(() => {
            refresh(e => e + 1);
          }, 10 * 1000);
        } else {
          await gotoBridge();
        }
      } finally {
        setReloadTxRefreshPaused(false);
        setMiniSignLoading(false);
        setFetchingBridgeQuote(false);
      }
      return;
    }

    gotoBridge();
  });

  const amountAvailable = useMemo(() => Number(amount) > 0, [amount]);

  const noQuote =
    inSufficientCanGetQuote &&
    !quoteBlockedByClosedMarket &&
    !!fromToken &&
    !!toToken &&
    Number(amount) > 0 &&
    !quoteLoading &&
    !quoteList?.length;
  const [bridgeProgressVisible, setBridgeProgressVisible] = useState(false);
  const showStickyInfo =
    !!fromToken &&
    !!toToken &&
    !noQuote &&
    !(bridgeProgressVisible && !amountAvailable);
  const showClosedMarketTip =
    (!!fromToken || !!toToken) && quoteBlockedByClosedMarket;

  const btnDisabled =
    inSufficient ||
    !fromToken ||
    !toToken ||
    !amountAvailable ||
    !selectedBridgeQuote ||
    quoteLoading ||
    !quoteList?.length;

  useEffect(() => {
    if (
      !sceneActive ||
      !regressionScenario.active ||
      regressionScenario.scenario !== 'swap-bridge' ||
      regressionScenario.params.tab !== 'bridge' ||
      !isRegressionBridgePairMatched ||
      !fromToken ||
      !toToken ||
      !amountAvailable ||
      quoteLoading ||
      !selectedBridgeQuote ||
      !quoteList?.length
    ) {
      return;
    }

    if (!regressionScenario.claimOnce('bridge-funded-dry-run-ready')) {
      return;
    }

    regressionScenario.report('assertion', {
      assertion: 'bridge-funded-dry-run-ready',
      passed: true,
      mode: 'dry-run',
      fromChain: fromToken.chain,
      fromToken: fromToken.symbol,
      toChain: toToken.chain,
      toToken: toToken.symbol,
      amount,
      aggregator: selectedBridgeQuote.aggregator.id,
      bridge: selectedBridgeQuote.bridge_id,
      quoteCount: quoteList.length,
    });
  }, [
    amount,
    amountAvailable,
    fromToken,
    isRegressionBridgePairMatched,
    quoteList?.length,
    quoteLoading,
    regressionScenario,
    sceneActive,
    selectedBridgeQuote,
    toToken,
  ]);

  useEffect(() => {
    const clearBuildTimer = () => {
      if (buildBridgeTxsTimerRef.current) {
        clearTimeout(buildBridgeTxsTimerRef.current);
        buildBridgeTxsTimerRef.current = null;
      }
    };

    if (!sceneActive || shouldPauseMiniSignerEffects()) {
      return clearBuildTimer;
    }
    if (
      !canUseMiniTx ||
      !canShowDirectSubmit ||
      !amountAvailable ||
      quoteBlockedByClosedMarket ||
      !quoteList?.length ||
      !selectedBridgeQuoteBuildKey ||
      !selectedBridgeQuoteCanAutoPreExec
    ) {
      return clearBuildTimer;
    }

    const tracker = bridgeAutoPreExecRef.current;
    if (tracker.requestId !== quoteRequestId) {
      tracker.requestId = quoteRequestId;
      tracker.earlyBuildKey = '';
      tracker.finalBuildKey = '';
      tracker.manualBuildKey = '';
    }

    const phase = allQuotesLoaded ? 'final' : 'early';
    if (selectedBridgeQuoteIsManualQuote) {
      if (tracker.manualBuildKey === selectedBridgeQuoteBuildKey) {
        return clearBuildTimer;
      }
    } else {
      if (!allQuotesLoaded && tracker.earlyBuildKey) {
        return clearBuildTimer;
      }
      if (allQuotesLoaded) {
        if (
          tracker.finalBuildKey === selectedBridgeQuoteBuildKey ||
          tracker.earlyBuildKey === selectedBridgeQuoteBuildKey
        ) {
          tracker.finalBuildKey = selectedBridgeQuoteBuildKey;
          return clearBuildTimer;
        }
      }
    }

    builtBridgeTxsKeyRef.current = '';
    prefetchedBridgeTxsKeyRef.current = '';
    mutateTxs([]);
    runBuildBridgeTxsRef.current = undefined;
    runBuildBridgeTxsKeyRef.current = '';

    const scheduledBuildKey = selectedBridgeQuoteBuildKey;
    const scheduledQuoteRequestId = quoteRequestId;
    const scheduledIsManualQuote = selectedBridgeQuoteIsManualQuote;
    buildBridgeTxsTimerRef.current = setTimeout(() => {
      buildBridgeTxsTimerRef.current = null;
      const latestTracker = bridgeAutoPreExecRef.current;
      if (
        quoteRequestIdRef.current !== scheduledQuoteRequestId ||
        latestTracker.requestId !== scheduledQuoteRequestId ||
        selectedBridgeQuoteBuildKeyRef.current !== scheduledBuildKey
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

      runBuildBridgeTxsForKey(scheduledBuildKey);
    }, BUILD_BRIDGE_TXS_DEBOUNCE_MS);

    return clearBuildTimer;
  }, [
    allQuotesLoaded,
    amountAvailable,
    canShowDirectSubmit,
    canUseMiniTx,
    mutateTxs,
    quoteBlockedByClosedMarket,
    quoteList?.length,
    quoteRequestId,
    runBuildBridgeTxsForKey,
    selectedBridgeQuoteBuildKey,
    selectedBridgeQuoteCanAutoPreExec,
    selectedBridgeQuoteIsManualQuote,
    sceneActive,
    shouldPauseMiniSignerEffects,
  ]);

  const btnText = useMemo(() => {
    if (showExternalDappTips) {
      return t('component.externalSwapBrideDappPopup.bridgeOnDapp');
    }
    if (btnDisabled) {
      return t('page.bridge.title');
    }

    if (selectedBridgeQuote?.shouldApproveToken) {
      return t('page.bridge.approve-and-bridge');
    }
    return t('page.bridge.title');
  }, [
    showExternalDappTips,
    btnDisabled,
    selectedBridgeQuote?.shouldApproveToken,
    t,
  ]);

  const switchFeePopup = useSetSettingVisible();

  const openFeePopup = useCallback(() => {
    switchFeePopup(true);
  }, [switchFeePopup]);

  const { switchAccountOnSelectedToken } =
    useSwitchSceneAccountOnSelectedTokenWithOwner('MakeTransactionAbout');
  const handleFromTokenChange = useMemoizedFn(
    (token: TokenItem | TokenItemMaybeWithOwner) => {
      const chainItem = findChainByServerID(token.chain);
      const normalSetChainToken = () => {
        if (chainItem?.enum !== fromChain) {
          switchFromChain(chainItem?.enum || CHAINS_ENUM.ETH);
        }
        handleAmountChange('');
        setFromToken(token);
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
    },
  );
  const handleBridgeAmountChange = useMemoizedFn((value: string) => {
    if (directSignBtnRef.current?.isAuthInProgress()) {
      return;
    }
    handleAmountChange(value);
  });
  const handleToTokenChange = useMemoizedFn((token: TokenItem) => {
    setToToken(token);
  });
  const handleFromChainChange = useMemoizedFn((chain: CHAINS_ENUM) => {
    switchFromChain(chain);
  });
  const handleToChainChange = useMemoizedFn((chain: CHAINS_ENUM) => {
    setToChain(chain);
  });
  const fromTokenExcludeChains = useMemo(
    () => (toChain ? [toChain] : undefined),
    [toChain],
  );
  const toTokenExcludeChains = useMemo(
    () => (fromChain ? [fromChain] : undefined),
    [fromChain],
  );

  const showLoss = useMemo(() => {
    const impact = tokenPriceImpact(
      fromToken,
      toToken,
      amount,
      selectedBridgeQuote?.to_token_amount,
    );
    return !!impact?.showLoss;
  }, [fromToken, amount, selectedBridgeQuote?.to_token_amount, toToken]);

  const showRiskTips =
    isSlippageHigh || isSlippageLow || showLoss || miniSignGasFeeTooHigh;
  const showRiskConfirm = showRiskTips && !btnDisabled && !miniSignLoading;
  const [riskChecked, setRiskChecked] = useState(false);
  const riskConfirmKey = useMemo(
    () =>
      [
        showRiskConfirm,
        fromToken?.chain,
        fromToken?.id,
        toToken?.chain,
        toToken?.id,
        amount,
        selectedBridgeQuote?.aggregator.id,
        selectedBridgeQuote?.bridge_id,
        selectedBridgeQuote?.to_token_amount,
        isSlippageHigh,
        isSlippageLow,
        showLoss,
        miniSignGasFeeTooHigh,
      ].join('|'),
    [
      showRiskConfirm,
      fromToken?.chain,
      fromToken?.id,
      toToken?.chain,
      toToken?.id,
      amount,
      selectedBridgeQuote?.aggregator.id,
      selectedBridgeQuote?.bridge_id,
      selectedBridgeQuote?.to_token_amount,
      isSlippageHigh,
      isSlippageLow,
      showLoss,
      miniSignGasFeeTooHigh,
    ],
  );
  const riskConfirmDisabled = showRiskConfirm && !riskChecked;

  useEffect(() => {
    setRiskChecked(false);
  }, [riskConfirmKey]);

  const handleConfirm = () => {
    if (showExternalDappTips && externalDapps.length > 0) {
      setExternalDappOpen(true);
      return;
    }

    if (fetchingBridgeQuote) {
      return;
    }
    if (!selectedBridgeQuote) {
      refresh(e => e + 1);

      return;
    }
    if (selectedBridgeQuote?.shouldTwoStepApprove) {
      setTwoStepApproveModalVisible(true);
      return;
    }
    handleBridge({ ignoreGasFee: riskChecked });
  };

  const [scrollEnabled, setScrollEnabled] = useState(true);
  const handleSlippageChange = useCallback(
    (nextSlippage: string) => {
      setSlippageChanged(true);
      setSlippage(nextSlippage);
    },
    [setSlippage, setSlippageChanged],
  );

  return (
    <SignatureInstanceProvider instance={instance}>
      <NormalScreenContainer overwriteStyle={styles.screen}>
        {diagnosticActive ? (
          <BridgeActivationDataProbe
            currentAddress={currentAccount?.address}
            fromChainReady={Boolean(fromChain)}
            fromTokenChain={fromToken?.chain}
            fromTokenId={fromToken?.id}
            toChainReady={Boolean(toChain)}
            toTokenChain={toToken?.chain}
            toTokenId={toToken?.id}
          />
        ) : null}
        {isForMultipleAddress && !disableAccountSwitcherModal && (
          <AccountSwitcherModal forScene="MakeTransactionAbout" inScreen />
        )}
        <BridgePendingTransactionsController
          ref={pendingTransactionsRef}
          disableHeaderRight={disableHeaderRight}
          enabled={sceneActive}
        />
        <KeyboardAwareScrollView
          style={styles.container}
          contentContainerStyle={{
            paddingBottom: 150 + bottom + (showRiskTips ? 26 : 0),
          }}
          enableOnAndroid
          scrollEnabled={scrollEnabled}
          extraHeight={200}
          keyboardOpeningTime={0}>
          <View style={styles.card}>
            <View style={styles.cardContainer}>
              <BridgeToken
                type="from"
                slider={slider}
                onChangeSlider={onChangeSlider}
                disabled={!isSupportedChain}
                account={currentAccount}
                inSufficient={inSufficient}
                chain={fromChain}
                token={fromToken}
                isMaxRef={isMaxRef}
                clickMaxBtnCount={clickMaxBtnCount}
                handleMax={handleMax}
                onSliderScrollEnabledChange={setScrollEnabled}
                onChangeToken={handleFromTokenChange}
                onChangeChain={handleFromChainChange}
                value={amount}
                onInputChange={handleBridgeAmountChange}
                excludeChains={fromTokenExcludeChains}
              />
              <BridgeToken
                type="to"
                account={currentAccount}
                chain={toChain}
                token={toToken}
                onChangeToken={handleToTokenChange}
                onChangeChain={handleToChainChange}
                fromChainId={
                  fromToken?.chain || findChainByEnum(fromChain)?.serverId
                }
                fromTokenId={fromToken?.id}
                valueLoading={quoteLoading}
                value={
                  quoteLoading
                    ? undefined
                    : selectedBridgeQuote?.to_token_amount
                }
                excludeChains={toTokenExcludeChains}
                noQuote={noQuote}
              />
              <BridgeSwitchBtn
                style={styles.switchButtonContainer}
                onPress={switchToken}
                loading={quoteLoading}
                refreshCountdown={
                  sceneActive && selectedBridgeQuote
                    ? quoteRefreshCountdown
                    : null
                }
              />
            </View>
          </View>

          {!isSupportedChain && fromChain && toChain ? (
            <View style={{ marginHorizontal: 22 }}>
              <ExternalSwapBridgeDappTips
                dappsAvailable={externalDapps?.length > 0}
              />
              <SwapBridgeDappPopup
                visible={externalDappOpen}
                onClose={() => {
                  setExternalDappOpen(false);
                }}
                dappList={externalDapps}
                openTab={openTab}
              />
            </View>
          ) : null}

          <View>
            {showStickyInfo && (
              <BridgeShowMore
                insufficient={inSufficient}
                duration={selectedBridgeQuote?.duration}
                supportDirectSign={canShowDirectSubmit}
                openFeePopup={openFeePopup}
                sourceName={selectedBridgeQuote?.aggregator.name || ''}
                sourceLogo={selectedBridgeQuote?.aggregator.logo_url || ''}
                slippage={slippageState}
                displaySlippage={slippage}
                onSlippageChange={handleSlippageChange}
                fromToken={fromToken}
                toToken={toToken}
                amount={amount || 0}
                toAmount={selectedBridgeQuote?.to_token_amount}
                openQuotesList={openQuotesList}
                quoteLoading={quoteLoading}
                slippageError={isSlippageHigh || isSlippageLow}
                autoSlippage={autoSlippage}
                isCustomSlippage={isCustomSlippage}
                setAutoSlippage={setAutoSlippage}
                setIsCustomSlippage={setIsCustomSlippage}
                type="bridge"
                isRabbyFeeFree={feeRate === '0'}
                isRabbyFeeHalf={feeRate === '0.12'}
                isBestQuote={
                  !!bestQuoteId &&
                  !!selectedBridgeQuote &&
                  bestQuoteId?.aggregatorId ===
                    selectedBridgeQuote.aggregator.id &&
                  bestQuoteId?.bridgeId === selectedBridgeQuote.bridge_id
                }
                onDepositPopupVisibleChange={setDepositQuoteRefreshPaused}
                onSlippageOptionsOpenChange={
                  setSlippageOptionsQuoteRefreshPaused
                }
                onGasSettingsOpenChange={setGasSettingsQuoteRefreshPaused}
              />
            )}
            {showClosedMarketTip && (
              <MarketClosedTip style={styles.marketClosedTip} />
            )}
            {noQuote && (
              <>
                {recommendFromToken ? (
                  <RecommendFromToken
                    token={recommendFromToken}
                    onOk={fillRecommendFromToken}
                  />
                ) : (
                  <>
                    <Text style={styles.noRecoomedTokenText}>
                      {t('page.bridge.no-quote-found')}
                    </Text>
                    <View style={{ marginHorizontal: 24, marginTop: 12 }}>
                      <BridgeSlippage
                        value={slippage}
                        displaySlippage={slippage}
                        onChange={handleSlippageChange}
                        autoSlippage={autoSlippage}
                        isCustomSlippage={isCustomSlippage}
                        setAutoSlippage={setAutoSlippage}
                        setIsCustomSlippage={setIsCustomSlippage}
                        type="bridge"
                        loading={quoteLoading}
                        onOptionsOpenChange={
                          setSlippageOptionsQuoteRefreshPaused
                        }
                      />
                    </View>
                  </>
                )}
              </>
            )}
          </View>
          {!amountAvailable &&
            !selectedBridgeQuote &&
            !recommendFromToken &&
            currentAccount?.address && (
              <BridgePendingTxItem
                userAddress={currentAccount.address}
                onDisplayChange={setBridgeProgressVisible}
              />
            )}
        </KeyboardAwareScrollView>

        <View
          style={[
            styles.buttonContainer,
            {
              paddingBottom:
                BOTTOM_BUTTON_BOTTOM_OFFSET + (IS_ANDROID ? bottom : 0),
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
                  key={`${selectedBridgeQuote?.aggregator.id}-${selectedBridgeQuote?.bridge?.id}-${refreshId}`}
                  height={BOTTOM_BUTTON_HEIGHT}
                  titleStyle={styles.bottomButtonTitle}
                  authTitle={t('page.whitelist.confirmPassword')}
                  title={t('global.confirm')}
                  loadingType="circle"
                  onFinished={() => handleBridge({ ignoreGasFee: riskChecked })}
                  disabled={
                    btnDisabled ||
                    !canDirectSign ||
                    miniSignLoading ||
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
                  loading={miniSignLoading}
                  showTextOnLoading
                />
              ) : (
                <Button
                  height={BOTTOM_BUTTON_HEIGHT}
                  onPress={handleConfirm}
                  title={btnText}
                  titleStyle={[styles.btnTitle, styles.bottomButtonTitle]}
                  loading={fetchingBridgeQuote}
                  disabled={
                    !isSupportedChain && externalDapps.length > 0
                      ? riskConfirmDisabled
                      : btnDisabled || riskConfirmDisabled
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
          onConfirm={() => handleBridge({ ignoreGasFee: riskChecked })}
        />

        {fromToken && toToken && Number(amount) > 0 ? (
          <QuoteList
            list={quoteList}
            loading={quoteLoading}
            visible={quoteVisible}
            onClose={() => {
              setQuoteVisible(false);
            }}
            userAddress={currentAccount?.address || ''}
            // chain={chain}
            payToken={fromToken}
            payAmount={amount}
            receiveToken={toToken}
            inSufficient={inSufficient}
            setSelectedBridgeQuote={setSelectedBridgeQuote}
            currentSelectedQuote={selectedBridgeQuote}
          />
        ) : null}
      </NormalScreenContainer>
    </SignatureInstanceProvider>
  );
};
