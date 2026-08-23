import { perpsServiceApi } from '@/core/serviceApi/perps';
import { PERPS_MINI_USD_VALUE } from '@/constant/perps';
import { isPerpsActionUserCancelled } from '@/hooks/perps/actions/actionError';
import { ensurePerpsActionApproval } from '@/hooks/perps/actions/perpsActionApproval';
import {
  buildPerpsUpdateLeverageCommand,
  executePerpsUpdateLeverage,
} from '@/hooks/perps/actions/updateLeverage';
import { showToast } from '@/hooks/perps/showToast';
import {
  subscribeToPerpsLatestTrade,
  type PerpsLatestTrade,
} from '@/hooks/perps/subscriptions/usePerpsLatestTrade';
import {
  getPerpsRuntimeIdentity,
  getPerpsRuntimeSnapshot,
} from '@/hooks/perps/runtime/perpsRuntimeState';
import {
  getPerpsAccountRuntimeContext,
  isPerpsUserAbstractionReadyForAccount,
  perpsStore,
} from '@/hooks/perps/usePerpsStore';
import {
  calLiquidationPrice,
  normalizePerpsMarketMarginMode,
} from '@/utils/perps';
import * as Sentry from '@sentry/react-native';
import type { L2Book, WsActiveAssetData } from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import {
  buildPerpsProOpenOrderCommand,
  executePerpsProOpenOrder,
  finalizePerpsProBboOpenOrderCommand,
  type PerpsProOpenOrderCommand,
} from '../actions/openOrder';
import {
  buildPerpsProAttachedTpSlCommand,
  hasPerpsProAttachedTpSlExecutionCapability,
  type PerpsProAttachedTpSlCommand,
} from '../actions/openOrderWithAttachedTpSl';
import type { PerpsProBboPrices, PerpsProBboStrategy } from '../model/bbo';
import { resolvePerpsProBboPrice } from '../model/bbo';
import {
  resolvePerpsProInitialLeverage,
  resolvePerpsProMarginModeDisabledReason,
  type PerpsProLeverageConfiguration,
} from '../model/leverage';
import { estimatePerpsProMarketFill } from '../model/marketFillEstimate';
import { resolvePerpsProMarketOrderProjection } from '../model/marketOrderProjection';
import type { PerpsProMarket } from '../model/market';
import type { PerpsProOrderReviewFacts } from '../model/orderReview';
import {
  createPerpsProTradeAmountDraft,
  getPerpsProTradeAmountDraftDisplay,
  repricePerpsProTradeAmountDraft,
  updatePerpsProTradeAmountDraft,
} from '../model/tradeAmountDraft';
import {
  createPerpsProAttachedTpSlDraft,
  evaluatePerpsProAttachedTpSl,
  type PerpsProAttachedTpSlDraft,
  type PerpsProTpSlValidationError,
} from '../model/tpsl';
import {
  createPerpsProTradeFormState,
  getPerpsProAmountInputDecimals,
  getPerpsProReduceOnlyAvailability,
  getPerpsProTradeExecutionPrice,
  inferPerpsProConditionalClassification,
  isPerpsProAmountAboveBothMax,
  resolvePerpsProMinimumOrderAmount,
  resolvePerpsProTradeAmount,
  sanitizePerpsProDecimalInput,
  type PerpsProConditionalExecution,
  type PerpsProTradeAmountSource,
  type PerpsProTradeAmountUnit,
  type PerpsProTradeOrderType,
  type PerpsProTradeSide,
  type PerpsProTradeTif,
} from '../model/trade';
import {
  getPerpsProMaxDisplayAmount,
  getPerpsProMaxDisplayReferencePrice,
  getPerpsProTradeDisplayReferencePrice,
  resolvePerpsProSliderAmount,
  resolvePerpsProMaxBaseCapacity,
  resolvePerpsProTradeProjection,
} from '../model/tradeProjection';
import { resolvePerpsProProjectedTradeRisk } from '../model/tradeRisk';
import {
  getPerpsProCollateralToken,
  resolvePerpsProCrossMarginAvailableAfterMaintenance,
} from '../model/tradeRiskAccount';
import {
  getPerpsProTpSlErrorText,
  type PerpsProTpSlErrorContext,
} from '../utils/tpSlError';
import {
  clearPerpsProTpSlForMarketChange,
  usePerpsProTpSl,
} from './usePerpsProTpSl';
import { usePerpsProTradePreferences } from './usePerpsProTradePreferences';
import type { PerpsProLeverageUpdateRequest } from './usePerpsProLeverageUpdate';
import { usePerpsProAttachedTpSlExecution } from './usePerpsProAttachedTpSlExecution';
import { usePerpsProTpSlModePreferences } from './usePerpsProTpSlModePreferences';

const positive = (value: unknown) => {
  const result = new BigNumber(
    (value as string | number | null | undefined) ?? Number.NaN,
  );
  return result.isFinite() && result.gt(0) ? result : null;
};

const getReviewParent = (
  review: PerpsProAttachedTpSlCommand | PerpsProOpenOrderCommand,
) => (review.type === 'openOrderWithAttachedTpSl' ? review.parent : review);

const getMatchingActiveAssetLeverage = (
  data: unknown,
  coin: string,
  address: string,
): PerpsProLeverageConfiguration | null => {
  const activeAsset = data as Partial<WsActiveAssetData> | null;
  const leverage = activeAsset?.leverage;
  if (
    activeAsset?.coin !== coin ||
    activeAsset.user?.toLowerCase() !== address.toLowerCase() ||
    (leverage?.type !== 'cross' && leverage?.type !== 'isolated') ||
    !Number.isFinite(leverage.value)
  ) {
    return null;
  }
  return leverage;
};

export const usePerpsProTrade = ({
  accountLeverageConfiguration = null,
  activeAssetData,
  bboBook,
  bboPrices,
  bboSessionKey,
  bboStatus,
  executionActive,
  leveragePending,
  market,
  tradeConfigurationReady = true,
  zeroAddressLeverageBaseline = null,
  refreshActiveAssetData,
  updateLeverageRequest,
}: {
  accountLeverageConfiguration?: PerpsProLeverageConfiguration | null;
  activeAssetData: WsActiveAssetData | null;
  bboBook: L2Book | null;
  bboPrices: PerpsProBboPrices;
  bboSessionKey: string | null;
  bboStatus: 'error' | 'idle' | 'loading' | 'ready' | 'stale';
  executionActive: boolean;
  leveragePending: boolean;
  market: PerpsProMarket | null;
  tradeConfigurationReady?: boolean;
  zeroAddressLeverageBaseline?: PerpsProLeverageConfiguration | null;
  refreshActiveAssetData: () => Promise<unknown>;
  updateLeverageRequest: (
    request: PerpsProLeverageUpdateRequest,
  ) => Promise<boolean>;
}) => {
  const { t } = useTranslation();
  const tpSlErrorText = useCallback(
    (error: PerpsProTpSlValidationError, context: PerpsProTpSlErrorContext) =>
      getPerpsProTpSlErrorText({
        context,
        error,
        t: (key, options) => t(key, options),
      }),
    [t],
  );
  const preferences = usePerpsProTradePreferences();
  const tpSlModePreferences = usePerpsProTpSlModePreferences();
  const tradeCoin = market?.canonicalCoin ?? '';
  const tradeDexId = market?.marketData.dexId ?? '';
  const collateralToken = getPerpsProCollateralToken(market?.quoteAsset);
  const accountFacts = perpsStore(
    useShallow(state => {
      const dexSummary =
        state.currentClearinghouseState?.perDexSummaries?.[tradeDexId];
      const unifiedAvailableAfterMaintenance =
        collateralToken == null
          ? null
          : state.spotState.tokenToAvailableAfterMaintenance?.find(
              ([token]) => token === collateralToken,
            )?.[1] ?? null;
      return {
        account: state.currentPerpsAccount,
        currentPosition:
          state.currentClearinghouseState?.assetPositions.find(
            item => item.position.coin === tradeCoin,
          )?.position ?? null,
        dexCrossAccountValue: dexSummary?.crossAccountValue ?? null,
        dexCrossMaintenanceMarginUsed:
          dexSummary?.crossMaintenanceMarginUsed ?? null,
        hasOpenOrders:
          !!tradeCoin &&
          state.openOrders.some(order => order.coin === tradeCoin),
        hasPermission: state.hasPermission,
        isUserDataReady: state.isUserDataReady,
        unifiedAvailableAfterMaintenance,
        userAbstraction: state.userAbstraction,
        userAbstractionReady: isPerpsUserAbstractionReadyForAccount(state),
      };
    }),
  );
  const [form, setForm] = useState(() =>
    createPerpsProTradeFormState({
      amountUnit: preferences.amountUnit,
      orderType: preferences.orderType,
      tpSlModes: tpSlModePreferences.opening,
    }),
  );
  const formRef = useRef(form);
  formRef.current = form;
  const [leverageConfigurationState, setLeverageConfigurationState] = useState<
    PerpsProLeverageConfiguration & { scopeKey: string | null }
  >({
    scopeKey: null,
    type: 'isolated',
    value: 1,
  });
  const [review, setReview] = useState<
    PerpsProAttachedTpSlCommand | PerpsProOpenOrderCommand | null
  >(null);
  const [pending, setPending] = useState(false);
  const [skipConfirmation, setSkipConfirmation] = useState(false);
  const [amountSource, setAmountSource] =
    useState<PerpsProTradeAmountSource>('manual');
  const [percentage, setPercentageState] = useState(0);
  const [priceFillFeedback, setPriceFillFeedback] = useState<{
    field: 'limitPrice' | 'triggerPrice';
    revision: number;
  } | null>(null);
  const amountSourceRef = useRef<PerpsProTradeAmountSource>('manual');
  const percentageRef = useRef(0);
  const priceFillRevisionRef = useRef(0);
  const amountDraftRef = useRef(createPerpsProTradeAmountDraft());
  const amountOverflowToastActiveRef = useRef(false);
  const latestTradeRef = useRef<PerpsLatestTrade | null>(null);
  const limitManualPriceRef = useRef<string | null>(null);
  const shouldAutoFillLimitPriceRef = useRef(form.orderType === 'limit');
  amountSourceRef.current = amountSource;
  percentageRef.current = percentage;
  const formRevisionRef = useRef(0);
  const pendingRef = useRef(false);
  const dirtyConfigurationRef = useRef(false);
  const appliedConfigurationRef = useRef<{
    accountIdentity: string;
    leverage: number;
    marginMode: 'cross' | 'isolated';
    marketKey: string;
  } | null>(null);
  const marketKeyRef = useRef<string | null>(null);
  const configurationAccountIdentityRef = useRef<string | null>(null);
  const currentMarketKeyRef = useRef<string | null>(market?.marketKey ?? null);
  const currentMidPriceRef = useRef<string | null>(
    market?.marketData.midPx || null,
  );
  const currentBboSessionKeyRef = useRef<string | null>(bboSessionKey);
  const currentBboStatusRef = useRef(bboStatus);
  const currentBboBookRef = useRef<L2Book | null>(bboBook);
  const currentBboPricesRef = useRef(bboPrices);
  currentMarketKeyRef.current = market?.marketKey ?? null;
  currentMidPriceRef.current = market?.marketData.midPx || null;
  currentBboSessionKeyRef.current = bboSessionKey;
  currentBboStatusRef.current = bboStatus;
  currentBboBookRef.current = bboBook;
  currentBboPricesRef.current = bboPrices;

  const scopedActiveAssetData =
    activeAssetData &&
    accountFacts.account &&
    activeAssetData.coin === tradeCoin &&
    activeAssetData.user.toLowerCase() ===
      accountFacts.account.address.toLowerCase()
      ? activeAssetData
      : null;
  const currentActiveAssetDataRef = useRef<WsActiveAssetData | null>(
    scopedActiveAssetData,
  );
  currentActiveAssetDataRef.current = scopedActiveAssetData;

  const { execute: executeAttachedTpSl } = usePerpsProAttachedTpSlExecution({
    active: executionActive,
    activeAssetData: scopedActiveAssetData,
    bboBook,
    bboSessionKey,
    bboStatus,
    market,
    refreshActiveAssetData,
  });

  const currentPosition = accountFacts.currentPosition;
  const hasOpenOrders = accountFacts.hasOpenOrders;
  const accountIdentity = accountFacts.account
    ? getPerpsRuntimeIdentity(accountFacts.account)
    : null;
  const currentPositionSize = new BigNumber(currentPosition?.szi ?? 0);
  const hasCurrentPosition =
    currentPositionSize.isFinite() && currentPositionSize.abs().gt(0);
  const marginModeConstraint = normalizePerpsMarketMarginMode(
    market?.marketData.marginMode,
    market?.marketData.onlyIsolated,
  );
  const currentAccountLeverageConfiguration =
    scopedActiveAssetData?.leverage ?? accountLeverageConfiguration;
  const initialLeverageConfiguration = useMemo(
    () =>
      resolvePerpsProInitialLeverage({
        accountConfiguration: currentAccountLeverageConfiguration,
        marginModeConstraint,
        maxLeverage: market?.marketData.maxLeverage ?? 1,
        position: hasCurrentPosition ? currentPosition?.leverage : null,
        zeroAddressBaseline: zeroAddressLeverageBaseline,
      }),
    [
      currentAccountLeverageConfiguration,
      currentPosition?.leverage,
      hasCurrentPosition,
      market?.marketData.maxLeverage,
      marginModeConstraint,
      zeroAddressLeverageBaseline,
    ],
  );
  const leverageConfigurationScopeKey = market
    ? `${accountIdentity ?? 'disconnected'}\u0000${market.marketKey}`
    : null;
  const leverageConfiguration =
    leverageConfigurationState.scopeKey === leverageConfigurationScopeKey
      ? leverageConfigurationState
      : {
          ...initialLeverageConfiguration,
          scopeKey: leverageConfigurationScopeKey,
        };
  const marginMode = leverageConfiguration.type;
  const leverage = leverageConfiguration.value;
  const applyLeverageConfiguration = useCallback(
    (configuration: PerpsProLeverageConfiguration, scopeKey: string | null) => {
      setLeverageConfigurationState(current =>
        current.scopeKey === scopeKey &&
        current.type === configuration.type &&
        current.value === configuration.value
          ? current
          : { ...configuration, scopeKey },
      );
    },
    [],
  );

  const crossMarginAvailableAfterMaintenance = useMemo(
    () =>
      resolvePerpsProCrossMarginAvailableAfterMaintenance({
        accountFactsReady:
          accountFacts.isUserDataReady && accountFacts.userAbstractionReady,
        dexCrossAccountValue: accountFacts.dexCrossAccountValue,
        dexCrossMaintenanceMarginUsed:
          accountFacts.dexCrossMaintenanceMarginUsed,
        unifiedAvailableAfterMaintenance:
          accountFacts.unifiedAvailableAfterMaintenance,
        userAbstraction: accountFacts.userAbstraction,
      }),
    [
      accountFacts.dexCrossAccountValue,
      accountFacts.dexCrossMaintenanceMarginUsed,
      accountFacts.isUserDataReady,
      accountFacts.unifiedAvailableAfterMaintenance,
      accountFacts.userAbstraction,
      accountFacts.userAbstractionReady,
    ],
  );

  useEffect(() => {
    if (configurationAccountIdentityRef.current === accountIdentity) return;
    configurationAccountIdentityRef.current = accountIdentity;
    appliedConfigurationRef.current = null;
    dirtyConfigurationRef.current = false;
    applyLeverageConfiguration(
      initialLeverageConfiguration,
      leverageConfigurationScopeKey,
    );
    setReview(null);
  }, [
    accountIdentity,
    applyLeverageConfiguration,
    initialLeverageConfiguration,
    leverageConfigurationScopeKey,
  ]);

  useEffect(() => {
    const marketKey = market?.marketKey ?? null;
    if (marketKeyRef.current === marketKey) return;
    marketKeyRef.current = marketKey;
    appliedConfigurationRef.current = null;
    dirtyConfigurationRef.current = false;
    applyLeverageConfiguration(
      initialLeverageConfiguration,
      leverageConfigurationScopeKey,
    );
    amountDraftRef.current = createPerpsProTradeAmountDraft();
    amountOverflowToastActiveRef.current = false;
    amountSourceRef.current = 'manual';
    latestTradeRef.current = null;
    limitManualPriceRef.current = null;
    percentageRef.current = 0;
    shouldAutoFillLimitPriceRef.current = formRef.current.orderType === 'limit';
    setAmountSource('manual');
    setPercentageState(0);
    setPriceFillFeedback(null);
    formRevisionRef.current += 1;
    setForm(current => {
      const next = {
        ...current,
        amount: '',
        attachedTpSl: clearPerpsProTpSlForMarketChange(current.attachedTpSl),
        bboEnabled: false,
        conditionalLimitPrice: '',
        limitPrice: '',
        triggerPrice: '',
      };
      formRef.current = next;
      return next;
    });
    setReview(null);
  }, [
    applyLeverageConfiguration,
    initialLeverageConfiguration,
    leverageConfigurationScopeKey,
    market,
  ]);

  useEffect(() => {
    const applied = appliedConfigurationRef.current;
    if (
      applied &&
      applied.accountIdentity === accountIdentity &&
      applied.marketKey === market?.marketKey
    ) {
      const authoritativeConfigurationReady =
        hasCurrentPosition || !!currentAccountLeverageConfiguration;
      if (
        !authoritativeConfigurationReady ||
        applied.marginMode !== initialLeverageConfiguration.type ||
        applied.leverage !== initialLeverageConfiguration.value
      ) {
        return;
      }
      appliedConfigurationRef.current = null;
    }
    if (dirtyConfigurationRef.current || !market) return;
    applyLeverageConfiguration(
      initialLeverageConfiguration,
      leverageConfigurationScopeKey,
    );
  }, [
    accountIdentity,
    applyLeverageConfiguration,
    currentAccountLeverageConfiguration,
    hasCurrentPosition,
    initialLeverageConfiguration,
    leverageConfigurationScopeKey,
    market,
  ]);

  const patchForm = useCallback((patch: Partial<typeof form>) => {
    formRevisionRef.current += 1;
    setForm(current => {
      const next = { ...current, ...patch };
      formRef.current = next;
      return next;
    });
  }, []);
  const marketPrice =
    market?.marketData.midPx || market?.marketData.markPx || '';
  const maxDisplayMarketPrice =
    positive(market?.marketData.midPx)?.toFixed() ??
    positive(market?.marketData.markPx)?.toFixed() ??
    '';
  const displayReferencePrice = getPerpsProTradeDisplayReferencePrice({
    form,
    marketPrice,
  });
  const amountDecimals = getPerpsProAmountInputDecimals({
    amountUnit: form.amountUnit,
    szDecimals: market?.marketData.szDecimals ?? 0,
  });
  const setPrice = useCallback(
    (
      field: 'conditionalLimitPrice' | 'limitPrice' | 'triggerPrice',
      value: string,
    ) => {
      const price = sanitizePerpsProDecimalInput(
        value,
        market?.marketData.pxDecimals ?? 2,
      );
      if (field === 'limitPrice') {
        limitManualPriceRef.current = price || null;
        shouldAutoFillLimitPriceRef.current = false;
      }
      patchForm({ [field]: price });
    },
    [market?.marketData.pxDecimals, patchForm],
  );
  const selectOrderBookPrice = useCallback(
    (price: string, sourceMarketKey: string) => {
      const currentForm = formRef.current;
      if (!positive(price) || sourceMarketKey !== currentMarketKeyRef.current) {
        return;
      }

      if (currentForm.orderType === 'limit') {
        if (currentForm.bboEnabled) return;
        setPrice('limitPrice', price);
        priceFillRevisionRef.current += 1;
        setPriceFillFeedback({
          field: 'limitPrice',
          revision: priceFillRevisionRef.current,
        });
        return;
      }
      if (currentForm.orderType === 'conditional') {
        setPrice('triggerPrice', price);
        priceFillRevisionRef.current += 1;
        setPriceFillFeedback({
          field: 'triggerPrice',
          revision: priceFillRevisionRef.current,
        });
      }
    },
    [setPrice],
  );
  const applyOrderType = useCallback(
    (orderType: PerpsProTradeOrderType) => {
      const currentForm = formRef.current;
      if (currentForm.orderType === orderType) return;

      const latestPrice = latestTradeRef.current
        ? sanitizePerpsProDecimalInput(
            latestTradeRef.current.price,
            market?.marketData.pxDecimals ?? 2,
          )
        : '';
      const nextForm = {
        ...currentForm,
        amount: '',
        conditionalLimitPrice: '',
        ...(orderType === 'limit'
          ? {
              bboEnabled: false,
              limitPrice: latestPrice,
            }
          : {}),
        orderType,
        triggerPrice: '',
      };

      amountDraftRef.current = createPerpsProTradeAmountDraft();
      amountOverflowToastActiveRef.current = false;
      amountSourceRef.current = 'manual';
      limitManualPriceRef.current = null;
      percentageRef.current = 0;
      shouldAutoFillLimitPriceRef.current =
        orderType === 'limit' && !latestPrice;
      formRef.current = nextForm;
      formRevisionRef.current += 1;
      setAmountSource('manual');
      setPercentageState(0);
      setForm(nextForm);
    },
    [market?.marketData.pxDecimals],
  );
  const applyAmountUnit = useCallback((amountUnit: PerpsProTradeAmountUnit) => {
    const currentForm = formRef.current;
    if (currentForm.amountUnit === amountUnit) return;

    amountOverflowToastActiveRef.current = false;

    amountDraftRef.current = createPerpsProTradeAmountDraft();
    amountSourceRef.current = 'manual';
    percentageRef.current = 0;
    setAmountSource('manual');
    setPercentageState(0);
    const nextForm = {
      ...currentForm,
      amount: '',
      amountUnit,
    };
    formRef.current = nextForm;
    formRevisionRef.current += 1;
    setForm(nextForm);
  }, []);
  const setOrderType = useCallback(
    (orderType: PerpsProTradeOrderType) => {
      applyOrderType(orderType);
      void preferences.setOrderType(orderType);
    },
    [applyOrderType, preferences],
  );

  useEffect(() => {
    if (!executionActive || !tradeCoin) {
      latestTradeRef.current = null;
      return;
    }
    return subscribeToPerpsLatestTrade(tradeCoin, snapshot => {
      if (snapshot.identity !== tradeCoin || !snapshot.trade) {
        return;
      }
      latestTradeRef.current = snapshot.trade;
      const currentForm = formRef.current;
      if (
        !shouldAutoFillLimitPriceRef.current ||
        currentForm.orderType !== 'limit' ||
        currentForm.bboEnabled ||
        limitManualPriceRef.current
      ) {
        return;
      }
      const limitPrice = sanitizePerpsProDecimalInput(
        snapshot.trade.price,
        market?.marketData.pxDecimals ?? 2,
      );
      if (!positive(limitPrice)) {
        return;
      }
      shouldAutoFillLimitPriceRef.current = false;
      patchForm({ limitPrice });
    });
  }, [executionActive, market?.marketData.pxDecimals, patchForm, tradeCoin]);

  const getRestoredLimitPrice = useCallback(() => {
    const latestPrice = latestTradeRef.current
      ? sanitizePerpsProDecimalInput(
          latestTradeRef.current.price,
          market?.marketData.pxDecimals ?? 2,
        )
      : '';
    return limitManualPriceRef.current ?? latestPrice;
  }, [market?.marketData.pxDecimals]);
  const enableBbo = useCallback(
    (bboStrategy: PerpsProBboStrategy) => {
      const currentForm = formRef.current;
      if (
        currentForm.orderType !== 'limit' ||
        currentForm.tif !== 'Gtc' ||
        currentForm.attachedTpSl.enabled
      ) {
        return;
      }
      patchForm({
        bboStrategy,
        bboEnabled: true,
      });
    },
    [patchForm],
  );
  const disableBbo = useCallback(() => {
    const currentForm = formRef.current;
    if (currentForm.orderType !== 'limit') return;
    const limitPrice = getRestoredLimitPrice();
    shouldAutoFillLimitPriceRef.current = !limitPrice;
    patchForm({ bboEnabled: false, limitPrice });
  }, [getRestoredLimitPrice, patchForm]);
  const setTif = useCallback(
    (tif: PerpsProTradeTif) => {
      const currentForm = formRef.current;
      if (currentForm.orderType !== 'limit') return;
      if (!currentForm.bboEnabled || tif === 'Gtc') {
        patchForm({ tif });
        return;
      }
      const limitPrice = getRestoredLimitPrice();
      shouldAutoFillLimitPriceRef.current = !limitPrice;
      patchForm({ bboEnabled: false, limitPrice, tif });
    },
    [getRestoredLimitPrice, patchForm],
  );

  useEffect(() => {
    if (!preferences.hydrated) return;
    applyOrderType(preferences.orderType);
    applyAmountUnit(preferences.amountUnit);
  }, [
    applyAmountUnit,
    applyOrderType,
    preferences.amountUnit,
    preferences.hydrated,
    preferences.orderType,
  ]);

  useEffect(() => {
    if (!tpSlModePreferences.hydrated) return;
    setForm(current => {
      const slMode =
        current.attachedTpSl.sl.rawMagnitude === ''
          ? tpSlModePreferences.opening.sl
          : current.attachedTpSl.sl.mode;
      const tpMode =
        current.attachedTpSl.tp.rawMagnitude === ''
          ? tpSlModePreferences.opening.tp
          : current.attachedTpSl.tp.mode;
      if (
        slMode === current.attachedTpSl.sl.mode &&
        tpMode === current.attachedTpSl.tp.mode
      ) {
        return current;
      }
      const attachedTpSl = {
        ...current.attachedTpSl,
        sl: { ...current.attachedTpSl.sl, mode: slMode },
        tp: { ...current.attachedTpSl.tp, mode: tpMode },
      };
      const next = { ...current, attachedTpSl };
      formRevisionRef.current += 1;
      formRef.current = next;
      return next;
    });
  }, [
    tpSlModePreferences.hydrated,
    tpSlModePreferences.opening.sl,
    tpSlModePreferences.opening.tp,
  ]);

  const toggleAmountUnit = useCallback(() => {
    const next = form.amountUnit === 'quote' ? 'base' : 'quote';
    applyAmountUnit(next);
    void preferences.setAmountUnit(next);
  }, [applyAmountUnit, form.amountUnit, preferences]);

  useEffect(() => {
    if (amountSource !== 'manual' || !amountDraftRef.current.inputSource) {
      return;
    }
    const nextDraft = repricePerpsProTradeAmountDraft({
      draft: amountDraftRef.current,
      price: displayReferencePrice,
      szDecimals: market?.marketData.szDecimals ?? 0,
    });
    amountDraftRef.current = nextDraft;
    const nextAmount = getPerpsProTradeAmountDraftDisplay(
      nextDraft,
      form.amountUnit,
    );
    setForm(current => {
      if (current.amount === nextAmount) return current;
      const next = { ...current, amount: nextAmount };
      formRef.current = next;
      return next;
    });
  }, [
    amountSource,
    displayReferencePrice,
    form.amountUnit,
    market?.marketData.szDecimals,
  ]);

  const marginModeDisabledReason = useMemo(
    () =>
      resolvePerpsProMarginModeDisabledReason({
        hasOpenOrders,
        hasPosition: hasCurrentPosition,
        marginModeConstraint,
      }),
    [hasCurrentPosition, hasOpenOrders, marginModeConstraint],
  );
  const setMarginMode = useCallback(
    async (next: 'cross' | 'isolated') => {
      if (
        !tradeConfigurationReady ||
        !accountFacts.account ||
        !accountIdentity ||
        !market ||
        leveragePending
      ) {
        return false;
      }
      if (next === marginMode) {
        return true;
      }
      if (marginModeDisabledReason) {
        showToast(
          t(
            marginModeDisabledReason === 'onlyIsolated'
              ? 'page.perps.pro.trade.onlyIsolatedMargin'
              : 'page.perps.pro.trade.marginModeUnavailable',
          ),
          'error',
        );
        return false;
      }
      dirtyConfigurationRef.current = true;
      const expectedMarketKey = market.marketKey;
      const expectedAccountIdentity = accountIdentity;
      const success = await updateLeverageRequest({
        account: accountFacts.account,
        action: 'marginMode',
        coin: market.canonicalCoin,
        currentIsCross: marginMode === 'cross',
        currentLeverage: leverage,
        isCross: next === 'cross',
        leverage,
        maxLeverage: market.marketData.maxLeverage,
      });
      if (!success) {
        dirtyConfigurationRef.current = false;
        return false;
      }
      const liveAccount = perpsStore.getState().currentPerpsAccount;
      if (
        currentMarketKeyRef.current !== expectedMarketKey ||
        !liveAccount ||
        getPerpsRuntimeIdentity(liveAccount) !== expectedAccountIdentity
      ) {
        dirtyConfigurationRef.current = false;
        return false;
      }
      setLeverageConfigurationState({
        scopeKey: leverageConfigurationScopeKey,
        type: next,
        value: leverage,
      });
      appliedConfigurationRef.current = {
        accountIdentity,
        leverage,
        marginMode: next,
        marketKey: market.marketKey,
      };
      dirtyConfigurationRef.current = false;
      return true;
    },
    [
      accountFacts.account,
      accountIdentity,
      leverage,
      leveragePending,
      leverageConfigurationScopeKey,
      marginMode,
      marginModeDisabledReason,
      market,
      t,
      tradeConfigurationReady,
      updateLeverageRequest,
    ],
  );
  const confirmLeverage = useCallback(
    async (next: number) => {
      if (
        !accountFacts.account ||
        !accountIdentity ||
        !market ||
        leveragePending ||
        !tradeConfigurationReady
      ) {
        return false;
      }
      const max = Math.max(1, market.marketData.maxLeverage);
      const normalized = Math.min(max, Math.max(1, Math.round(next)));
      const success = await updateLeverageRequest({
        account: accountFacts.account,
        coin: market.canonicalCoin,
        currentIsCross: marginMode === 'cross',
        currentLeverage: leverage,
        isCross: marginMode === 'cross',
        leverage: normalized,
        maxLeverage: max,
      });
      if (!success) return false;
      setLeverageConfigurationState({
        scopeKey: leverageConfigurationScopeKey,
        type: marginMode,
        value: normalized,
      });
      appliedConfigurationRef.current = {
        accountIdentity,
        leverage: normalized,
        marginMode,
        marketKey: market.marketKey,
      };
      dirtyConfigurationRef.current = false;
      return true;
    },
    [
      accountFacts.account,
      accountIdentity,
      leverage,
      leveragePending,
      leverageConfigurationScopeKey,
      marginMode,
      market,
      tradeConfigurationReady,
      updateLeverageRequest,
    ],
  );

  const getBboPrice = useCallback(
    (side: PerpsProTradeSide) =>
      resolvePerpsProBboPrice({
        isBuy: side === 'buy',
        prices: bboPrices,
        strategy: form.bboStrategy,
      }),
    [bboPrices, form.bboStrategy],
  );
  const reduceOnlyAvailability = useMemo(
    () =>
      getPerpsProReduceOnlyAvailability({
        currentPositionSize: currentPosition?.szi,
        isUserDataReady: accountFacts.isUserDataReady,
        reduceOnly: form.reduceOnly,
      }),
    [accountFacts.isUserDataReady, currentPosition?.szi, form.reduceOnly],
  );

  useEffect(() => {
    if (
      !accountFacts.isUserDataReady ||
      !market?.marketKey ||
      !form.reduceOnly ||
      reduceOnlyAvailability.hasPosition
    ) {
      return;
    }
    setForm(current =>
      current.reduceOnly ? { ...current, reduceOnly: false } : current,
    );
  }, [
    accountFacts.isUserDataReady,
    form.reduceOnly,
    market?.marketKey,
    reduceOnlyAvailability.hasPosition,
  ]);

  const getSideExecutionPrice = useCallback(
    (side: PerpsProTradeSide) =>
      getPerpsProTradeExecutionPrice({
        bboPrice: getBboPrice(side),
        form,
        marketPrice,
      }),
    [form, getBboPrice, marketPrice],
  );
  const getMaxBase = useCallback(
    (side: PerpsProTradeSide) => {
      if (form.reduceOnly) {
        const sideUnavailable =
          side === 'buy'
            ? reduceOnlyAvailability.buyUnavailable
            : reduceOnlyAvailability.sellUnavailable;
        return sideUnavailable
          ? new BigNumber(0)
          : new BigNumber(currentPosition?.szi ?? 0).abs();
      }
      const serverMaxBase =
        scopedActiveAssetData?.maxTradeSzs[side === 'buy' ? 0 : 1] ?? '0';
      const maxReferencePrice = getPerpsProMaxDisplayReferencePrice({
        form,
        marketPrice: maxDisplayMarketPrice,
      });
      return new BigNumber(
        resolvePerpsProMaxBaseCapacity({
          availableQuote: scopedActiveAssetData
            ? BigNumber.min(
                scopedActiveAssetData.availableToTrade[0],
                scopedActiveAssetData.availableToTrade[1],
              ).toFixed()
            : '0',
          currentPositionSize: currentPosition?.szi,
          leverage,
          orderType: form.orderType,
          referencePrice: maxReferencePrice,
          serverMaxBase,
          side,
          szDecimals: market?.marketData.szDecimals ?? 0,
        }),
      );
    },
    [
      currentPosition?.szi,
      form,
      leverage,
      market?.marketData.szDecimals,
      maxDisplayMarketPrice,
      reduceOnlyAvailability.buyUnavailable,
      reduceOnlyAvailability.sellUnavailable,
      scopedActiveAssetData,
    ],
  );
  const getMaxDisplayAmount = useCallback(
    (side: PerpsProTradeSide) =>
      getPerpsProMaxDisplayAmount({
        amountUnit: form.amountUnit,
        maxBase: getMaxBase(side).toFixed(),
        referencePrice: getPerpsProMaxDisplayReferencePrice({
          form,
          marketPrice: maxDisplayMarketPrice,
        }),
      }),
    [form, getMaxBase, maxDisplayMarketPrice],
  );
  const setAmount = useCallback(
    (value: string) => {
      const amount = sanitizePerpsProDecimalInput(value, amountDecimals);
      amountDraftRef.current = updatePerpsProTradeAmountDraft({
        amount,
        amountUnit: form.amountUnit,
        price: displayReferencePrice,
        szDecimals: market?.marketData.szDecimals ?? 0,
      });
      amountSourceRef.current = 'manual';
      percentageRef.current = 0;
      setAmountSource('manual');
      setPercentageState(0);
      patchForm({ amount });

      const amountAboveBothMax =
        !form.reduceOnly &&
        tradeConfigurationReady &&
        isPerpsProAmountAboveBothMax({
          amount,
          buyMax: getMaxDisplayAmount('buy'),
          sellMax: getMaxDisplayAmount('sell'),
        });
      if (amountAboveBothMax && !amountOverflowToastActiveRef.current) {
        showToast(t('page.perps.pro.trade.insufficientBalance'), 'error');
      }
      amountOverflowToastActiveRef.current = amountAboveBothMax;
    },
    [
      amountDecimals,
      displayReferencePrice,
      form.amountUnit,
      form.reduceOnly,
      getMaxDisplayAmount,
      market?.marketData.szDecimals,
      patchForm,
      t,
      tradeConfigurationReady,
    ],
  );
  const beginAmountEntry = useCallback(() => {
    if (amountSource !== 'slider') return;
    amountDraftRef.current = createPerpsProTradeAmountDraft();
    amountOverflowToastActiveRef.current = false;
    amountSourceRef.current = 'manual';
    percentageRef.current = 0;
    setAmountSource('manual');
    setPercentageState(0);
    patchForm({ amount: '' });
  }, [amountSource, patchForm]);
  const getSideProjection = useCallback(
    (side: PerpsProTradeSide) =>
      resolvePerpsProTradeProjection({
        amount: form.amount,
        amountSource,
        amountUnit: form.amountUnit,
        currentPositionSize: currentPosition?.szi,
        displayPrice: displayReferencePrice,
        executionPrice: getSideExecutionPrice(side),
        leverage,
        maxBase: getMaxBase(side).toFixed(),
        percentage,
        reduceOnly: form.reduceOnly,
        side,
        szDecimals: market?.marketData.szDecimals ?? 0,
      }),
    [
      amountSource,
      currentPosition?.szi,
      displayReferencePrice,
      form.amount,
      form.amountUnit,
      form.reduceOnly,
      getMaxBase,
      getSideExecutionPrice,
      leverage,
      market?.marketData.szDecimals,
      percentage,
    ],
  );
  const getSliderButtonDisplayAmount = useCallback(
    (side: PerpsProTradeSide) => {
      if (amountSource !== 'slider' || percentage <= 0) {
        return null;
      }
      if (!getMaxBase(side).gt(0)) {
        return '0';
      }
      const resolved = resolvePerpsProSliderAmount({
        maxBase: getMaxBase(side).toFixed(),
        percentage,
        price: displayReferencePrice,
        szDecimals: market?.marketData.szDecimals ?? 0,
      });
      if (!resolved) {
        return positive(displayReferencePrice) ? '0' : null;
      }
      return form.amountUnit === 'base'
        ? resolved.baseSize
        : resolved.quoteAmount;
    },
    [
      amountSource,
      displayReferencePrice,
      form.amountUnit,
      getMaxBase,
      market?.marketData.szDecimals,
      percentage,
    ],
  );
  const getSideMarketOrderProjection = useCallback(
    (side: PerpsProTradeSide) => {
      if (!market || form.orderType !== 'market') return null;
      const projection = getSideProjection(side);
      if (!projection) return null;
      return resolvePerpsProMarketOrderProjection({
        baseSize: projection.baseSize,
        book: bboBook,
        coin: market.canonicalCoin,
        midPrice: market.marketData.midPx,
        sessionKey: bboSessionKey,
        side,
        status: bboStatus,
        szDecimals: market.marketData.szDecimals,
      });
    },
    [
      bboBook,
      bboSessionKey,
      bboStatus,
      form.orderType,
      getSideProjection,
      market,
    ],
  );
  const getCostDisplayAmount = useCallback(
    (side: PerpsProTradeSide) => {
      const projection = getSideProjection(side);
      if (!projection) return '0';
      const marketProjection = getSideMarketOrderProjection(side);
      if (marketProjection?.source !== 'fullL2') return projection.costQuote;
      const netNewBase = positive(projection.netNewBaseSize);
      return netNewBase
        ? netNewBase
            .multipliedBy(marketProjection.estimatedEntryPrice)
            .dividedBy(Math.max(1, leverage))
            .toFixed(2)
        : '0';
    },
    [getSideMarketOrderProjection, getSideProjection, leverage],
  );
  const setPercentage = useCallback(
    (percent: number) => {
      amountOverflowToastActiveRef.current = false;
      const next = Math.max(0, Math.min(100, percent));
      const nextSource = next === 0 ? 'manual' : 'slider';
      if (next === 0) {
        amountDraftRef.current = createPerpsProTradeAmountDraft();
      }
      amountSourceRef.current = nextSource;
      percentageRef.current = next;
      setAmountSource(nextSource);
      setPercentageState(next);
      patchForm({ amount: next === 0 ? '' : `${next}%` });
    },
    [patchForm],
  );

  const getCommandForm = useCallback(
    (side: PerpsProTradeSide) => {
      const projection = getSideProjection(side);
      const shouldFreezeProjectedBase =
        amountSource === 'slider' ||
        (form.orderType === 'limit' &&
          form.bboEnabled &&
          form.amountUnit === 'quote');
      return projection && shouldFreezeProjectedBase
        ? { ...form, amount: projection.baseSize, amountUnit: 'base' as const }
        : form;
    },
    [amountSource, form, getSideProjection],
  );

  const getTpSlPreviewFacts = useCallback(
    (side: PerpsProTradeSide) => {
      if (
        !market ||
        form.orderType === 'conditional' ||
        (form.orderType === 'limit' && form.bboEnabled)
      ) {
        return null;
      }
      const commandForm = getCommandForm(side);
      if (commandForm.orderType === 'market') {
        const result = estimatePerpsProMarketFill({
          amount: commandForm.amount,
          amountUnit: commandForm.amountUnit,
          book: bboBook,
          coin: market.canonicalCoin,
          sessionKey: bboSessionKey,
          side,
          status: bboStatus,
          szDecimals: market.marketData.szDecimals,
        });
        return result.ok
          ? {
              baseSize: result.estimate.baseSize,
              expectedEntryPrice: result.estimate.expectedEntryPrice,
            }
          : null;
      }
      const amount = resolvePerpsProTradeAmount({
        amount: commandForm.amount,
        amountUnit: commandForm.amountUnit,
        price: commandForm.limitPrice,
        szDecimals: market.marketData.szDecimals,
      });
      return amount
        ? {
            baseSize: amount.baseSize,
            expectedEntryPrice: commandForm.limitPrice,
          }
        : null;
    },
    [
      bboBook,
      bboSessionKey,
      bboStatus,
      form.bboEnabled,
      form.orderType,
      getCommandForm,
      market,
    ],
  );
  const tpSlPreviewFacts = useMemo(
    () => ({
      buy: getTpSlPreviewFacts('buy'),
      sell: getTpSlPreviewFacts('sell'),
    }),
    [getTpSlPreviewFacts],
  );
  const patchAttachedTpSl = useCallback(
    (attachedTpSl: PerpsProAttachedTpSlDraft) => {
      const currentForm = formRef.current;
      const enablingWhileBboActive =
        attachedTpSl.enabled &&
        !currentForm.attachedTpSl.enabled &&
        currentForm.orderType === 'limit' &&
        currentForm.bboEnabled;
      if (!enablingWhileBboActive) {
        patchForm({ attachedTpSl });
        return;
      }

      const latestPrice = latestTradeRef.current
        ? sanitizePerpsProDecimalInput(
            latestTradeRef.current.price,
            market?.marketData.pxDecimals ?? 2,
          )
        : '';
      limitManualPriceRef.current = null;
      shouldAutoFillLimitPriceRef.current = !latestPrice;
      patchForm({
        attachedTpSl,
        bboEnabled: false,
        bboStrategy: null,
        limitPrice: latestPrice,
      });
    },
    [market?.marketData.pxDecimals, patchForm],
  );
  const tpSl = usePerpsProTpSl({
    draft: form.attachedTpSl,
    leverage,
    onChange: patchAttachedTpSl,
    onModeChange: (kind, mode) => {
      void tpSlModePreferences.setMode({
        leg: kind,
        mode,
        surface: 'opening',
      });
    },
    order: form,
    previewFacts: tpSlPreviewFacts,
    pxDecimals: market?.marketData.pxDecimals ?? 2,
    szDecimals: market?.marketData.szDecimals ?? 0,
  });
  const buildReview = useCallback(
    (side: PerpsProTradeSide) => {
      if (!accountFacts.account || !market) {
        throw new Error(t('page.perps.pro.trade.accountRequired'));
      }
      const reduceOnlyDirectionUnavailable =
        side === 'buy'
          ? reduceOnlyAvailability.buyUnavailable
          : reduceOnlyAvailability.sellUnavailable;
      if (form.reduceOnly && reduceOnlyDirectionUnavailable) {
        throw new Error(t('page.perps.pro.trade.reduceOnlyUnavailable'));
      }
      const commandForm = getCommandForm(side);
      const hasAttached = commandForm.attachedTpSl.enabled;
      const liveMidPrice = market.marketData.midPx;
      if (
        (commandForm.orderType === 'market' ||
          commandForm.orderType === 'conditional') &&
        !positive(liveMidPrice)
      ) {
        throw new Error(t('page.perps.pro.trade.contextChanged'));
      }
      const plainMarketProjection =
        commandForm.orderType === 'market' && !hasAttached
          ? getSideMarketOrderProjection(side)
          : null;
      let expectedEntryPrice =
        commandForm.orderType === 'conditional'
          ? liveMidPrice
          : liveMidPrice || market.marketData.markPx;
      if (!positive(expectedEntryPrice)) {
        throw new Error(t('page.perps.pro.trade.contextChanged'));
      }
      const generatedAt = Date.now();
      const reviewFacts: PerpsProOrderReviewFacts = Object.freeze({
        amountUnit: form.amountUnit,
        displayBase: market.displayBase,
        displayPair: market.displayPair,
        formRevision: formRevisionRef.current,
        generatedAt,
        leverage,
        marginMode,
        markPrice: market.marketData.markPx,
        marketFillRiskEntryPrice:
          plainMarketProjection?.source === 'fullL2'
            ? plainMarketProjection.estimatedEntryPrice
            : null,
        maxLeverage: market.marketData.maxLeverage,
        midPrice: liveMidPrice,
        pxDecimals: market.marketData.pxDecimals,
        quoteAsset: market.quoteAsset,
        sourceTag: market.sourceTag ?? null,
        szDecimals: market.marketData.szDecimals,
      });
      let marketSnapshot:
        | Omit<
            PerpsProAttachedTpSlCommand['marketSnapshot'],
            'normalizedBaseSize'
          >
        | undefined;
      if (hasAttached && commandForm.orderType === 'market') {
        const estimate = estimatePerpsProMarketFill({
          amount: commandForm.amount,
          amountUnit: commandForm.amountUnit,
          book: bboBook,
          coin: market.canonicalCoin,
          sessionKey: bboSessionKey,
          side,
          status: bboStatus,
          szDecimals: market.marketData.szDecimals,
        });
        if (!estimate.ok) {
          const error = {
            code:
              estimate.error === 'insufficientDepth'
                ? ('insufficientDepth' as const)
                : estimate.error === 'invalidAmount' ||
                  estimate.error === 'zeroNormalizedSize'
                ? ('invalidOrderAmount' as const)
                : ('marketBookUnavailable' as const),
          };
          const errorContext = { side };
          throw new Error(tpSlErrorText(error, errorContext));
        }
        expectedEntryPrice = estimate.estimate.expectedEntryPrice;
        marketSnapshot = {
          bookTime: estimate.estimate.bookTime,
          expectedEntryPrice: estimate.estimate.expectedEntryPrice,
          sessionKey: estimate.estimate.sessionKey,
        };
      } else if (hasAttached) {
        if (
          bboStatus !== 'ready' ||
          !bboBook ||
          !bboSessionKey ||
          bboBook.coin !== market.canonicalCoin ||
          !Number.isFinite(bboBook.time) ||
          bboBook.time <= 0
        ) {
          const error = { code: 'marketBookUnavailable' as const };
          const errorContext = { side };
          throw new Error(tpSlErrorText(error, errorContext));
        }
        marketSnapshot = {
          bookTime: bboBook.time,
          expectedEntryPrice: commandForm.limitPrice,
          sessionKey: bboSessionKey,
        };
      }
      const parentForm = hasAttached
        ? {
            ...commandForm,
            attachedTpSl: { ...commandForm.attachedTpSl, enabled: false },
          }
        : commandForm;
      const command = buildPerpsProOpenOrderCommand({
        account: accountFacts.account,
        amountReferencePrice:
          hasAttached && commandForm.orderType === 'market'
            ? expectedEntryPrice
            : undefined,
        bboPrice: getBboPrice(side),
        bboSessionKey,
        bestAsk: bboPrices.asks1,
        bestBid: bboPrices.bids1,
        coin: market.canonicalCoin,
        dexId: market.marketData.dexId,
        form: parentForm,
        marketKey: market.marketKey,
        marketPrice:
          commandForm.orderType === 'market'
            ? liveMidPrice
            : expectedEntryPrice,
        maxUsdValueSize: market.marketData.maxUsdValueSize,
        reviewFacts,
        side,
        szDecimals: market.marketData.szDecimals,
      });
      if (form.reduceOnly) {
        const signedSize = positive(
          new BigNumber(currentPosition?.szi ?? 0).abs(),
        );
        if (!signedSize || new BigNumber(command.baseSize).gt(signedSize)) {
          throw new Error(t('page.perps.pro.trade.reduceOnlyUnavailable'));
        }
      }
      const maxBase = getMaxBase(side);
      if (!maxBase.gt(0) || new BigNumber(command.baseSize).gt(maxBase)) {
        throw new Error(t('page.perps.pro.trade.insufficientBalance'));
      }
      if (!hasAttached) {
        return command;
      }
      if (command.execution.kind === 'limit') {
        expectedEntryPrice = command.execution.limitPrice;
      }
      const risk = resolvePerpsProProjectedTradeRisk({
        baseSize: command.baseSize,
        calculateLiquidationPrice: calLiquidationPrice,
        crossMarginAvailableAfterMaintenance,
        currentPosition,
        entryPrice: expectedEntryPrice,
        leverage,
        marginMode,
        markPrice: market.marketData.markPx,
        maxLeverage: market.marketData.maxLeverage,
        pxDecimals: market.marketData.pxDecimals,
        side,
      });
      const evaluation = evaluatePerpsProAttachedTpSl({
        baseSize: command.baseSize,
        currentPositionSize: currentPosition?.szi,
        draft: commandForm.attachedTpSl,
        expectedEntryPrice,
        leverage,
        liquidationPrice: risk?.liquidationPrice ?? null,
        order: commandForm,
        side,
        szDecimals: market.marketData.szDecimals,
      });
      const errorContext = { side };
      if (evaluation.errors.length > 0) {
        throw new Error(tpSlErrorText(evaluation.errors[0], errorContext));
      }
      if (!marketSnapshot) {
        throw new Error(t('page.perps.pro.trade.contextChanged'));
      }
      return buildPerpsProAttachedTpSlCommand({
        accountRuntime: getPerpsAccountRuntimeContext(),
        amountUnit: form.amountUnit,
        attached: evaluation,
        displayBase: market.displayBase,
        displayPair: market.displayPair,
        formRevision: reviewFacts.formRevision,
        generatedAt: reviewFacts.generatedAt,
        leverage,
        liquidationGap: risk?.gap ?? null,
        marginMode,
        markPrice: market.marketData.markPx,
        maxLeverage: market.marketData.maxLeverage,
        midPrice: reviewFacts.midPrice,
        marketSnapshot: {
          ...marketSnapshot,
          normalizedBaseSize: command.baseSize,
        },
        parent: command,
        position: currentPosition,
        pxDecimals: market.marketData.pxDecimals,
        quoteAsset: market.quoteAsset,
        runtime: getPerpsRuntimeSnapshot(),
        sourceTag: reviewFacts.sourceTag,
        szDecimals: market.marketData.szDecimals,
      });
    },
    [
      accountFacts.account,
      bboBook,
      bboPrices.asks1,
      bboPrices.bids1,
      bboSessionKey,
      bboStatus,
      currentPosition,
      crossMarginAvailableAfterMaintenance,
      form,
      getBboPrice,
      getCommandForm,
      getMaxBase,
      getSideMarketOrderProjection,
      leverage,
      marginMode,
      market,
      reduceOnlyAvailability.buyUnavailable,
      reduceOnlyAvailability.sellUnavailable,
      t,
      tpSlErrorText,
    ],
  );

  const resolveLeverageExecutionReadiness = useCallback(
    async ({
      address,
      coin,
      desired,
      expectedAccountIdentity,
      marketKey,
    }: {
      address: string;
      coin: string;
      desired: PerpsProOrderReviewFacts;
      expectedAccountIdentity: string;
      marketKey: string;
    }) => {
      const appliedConfiguration = appliedConfigurationRef.current;
      const appliedMatches =
        appliedConfiguration?.marketKey === marketKey &&
        appliedConfiguration.accountIdentity === expectedAccountIdentity &&
        appliedConfiguration.marginMode === desired.marginMode &&
        appliedConfiguration.leverage === desired.leverage;
      const evaluate = (
        activeLeverage: PerpsProLeverageConfiguration,
      ): 'aligned' | 'contextChanged' | 'needsUpdate' => {
        if (
          activeLeverage.type === desired.marginMode &&
          activeLeverage.value === desired.leverage
        ) {
          return 'aligned';
        }
        if (appliedMatches) {
          return 'aligned';
        }
        return dirtyConfigurationRef.current ? 'needsUpdate' : 'contextChanged';
      };

      if (currentAccountLeverageConfiguration) {
        return evaluate(currentAccountLeverageConfiguration);
      }
      if (appliedMatches) {
        return 'aligned' as const;
      }
      if (dirtyConfigurationRef.current) {
        return 'needsUpdate' as const;
      }

      try {
        const refreshed = await refreshActiveAssetData();
        const refreshedLeverage = getMatchingActiveAssetLeverage(
          refreshed,
          coin,
          address,
        );
        return refreshedLeverage
          ? evaluate(refreshedLeverage)
          : ('contextChanged' as const);
      } catch (error) {
        Sentry.captureException(error, {
          extra: { scene: 'Perps Pro leverage execution preflight' },
        });
        return 'contextChanged' as const;
      }
    },
    [currentAccountLeverageConfiguration, refreshActiveAssetData],
  );

  const execute = useCallback(
    async (command: PerpsProOpenOrderCommand) => {
      if (
        pendingRef.current ||
        !tradeConfigurationReady ||
        !accountFacts.account ||
        !accountIdentity ||
        !market
      ) {
        return;
      }
      if (!perpsStore.getState().hasPermission) {
        showToast(t('page.perps.regionNotSupport'), 'error');
        setReview(null);
        return;
      }
      const desired = command.reviewFacts;
      if (!desired) {
        showToast(t('page.perps.pro.trade.contextChanged'), 'error');
        setReview(null);
        return;
      }
      const isConditionalClassificationCurrent = () => {
        if (
          command.execution.kind !== 'conditionalLimit' &&
          command.execution.kind !== 'conditionalMarket'
        ) {
          return true;
        }
        const latestMid = currentMidPriceRef.current;
        if (!positive(latestMid)) return false;
        return (
          inferPerpsProConditionalClassification({
            isBuy: command.side === 'buy',
            referencePrice: latestMid ?? '',
            triggerPrice: command.execution.triggerPrice,
          }) === command.execution.tpsl
        );
      };
      const isSceneCurrent = () =>
        currentMarketKeyRef.current === command.marketKey &&
        accountIdentity === getPerpsRuntimeIdentity(command.account) &&
        formRevisionRef.current === desired.formRevision &&
        (!command.bboSessionKey ||
          currentBboSessionKeyRef.current === command.bboSessionKey) &&
        isConditionalClassificationCurrent();
      if (!isSceneCurrent()) {
        showToast(t('page.perps.pro.trade.contextChanged'), 'error');
        setReview(null);
        return;
      }
      pendingRef.current = true;
      setPending(true);
      try {
        await ensurePerpsActionApproval(accountFacts.account);
        if (!perpsStore.getState().hasPermission) {
          showToast(t('page.perps.regionNotSupport'), 'error');
          setReview(null);
          return;
        }
        if (!isSceneCurrent()) {
          showToast(t('page.perps.pro.trade.contextChanged'), 'error');
          setReview(null);
          return;
        }
        const leverageReadiness = await resolveLeverageExecutionReadiness({
          address: command.account.address,
          coin: command.coin,
          desired,
          expectedAccountIdentity: accountIdentity,
          marketKey: command.marketKey,
        });
        if (leverageReadiness === 'contextChanged') {
          showToast(t('page.perps.pro.trade.contextChanged'), 'error');
          setReview(null);
          return;
        }
        if (leverageReadiness === 'needsUpdate') {
          const leverageCommand = buildPerpsUpdateLeverageCommand({
            account: command.account,
            coin: command.coin,
            isCross: desired.marginMode === 'cross',
            leverage: desired.leverage,
            maxLeverage: desired.maxLeverage,
          });
          const leverageResult = await executePerpsUpdateLeverage(
            leverageCommand,
          );
          if (leverageResult.kind !== 'success') {
            if (leverageResult.kind === 'staleContext') {
              showToast(t('page.perps.pro.trade.contextChanged'), 'error');
              setReview(null);
              return;
            }
            throw new Error(leverageResult.error || 'Leverage update failed');
          }
          appliedConfigurationRef.current = {
            accountIdentity,
            leverage: desired.leverage,
            marginMode: desired.marginMode,
            marketKey: command.marketKey,
          };
        }
        let executableCommand = command;
        if (command.execution.kind === 'bboLimit') {
          const liveBook = currentBboBookRef.current;
          const liveSessionKey = currentBboSessionKeyRef.current;
          if (
            currentBboStatusRef.current !== 'ready' ||
            !liveBook ||
            liveBook.coin !== command.coin ||
            !Number.isFinite(liveBook.time) ||
            liveBook.time <= 0 ||
            !liveSessionKey ||
            liveSessionKey !== command.bboSessionKey
          ) {
            throw new Error(t('page.perps.pro.trade.contextChanged'));
          }
          const latePrice = resolvePerpsProBboPrice({
            isBuy: command.side === 'buy',
            prices: currentBboPricesRef.current,
            strategy: command.execution.strategy,
          });
          const price = positive(latePrice);
          if (!price) {
            throw new Error(t('page.perps.pro.trade.contextChanged'));
          }
          const baseSize = positive(command.baseSize);
          if (!baseSize) {
            throw new Error(t('page.perps.pro.trade.contextChanged'));
          }
          const livePosition = perpsStore
            .getState()
            .currentClearinghouseState?.assetPositions.find(
              item => item.position.coin === command.coin,
            )?.position;
          const liveActiveAsset = currentActiveAssetDataRef.current;
          const liveMaxBase = command.reduceOnly
            ? positive(new BigNumber(livePosition?.szi ?? 0).abs())
            : liveActiveAsset
            ? positive(
                resolvePerpsProMaxBaseCapacity({
                  availableQuote: BigNumber.min(
                    liveActiveAsset.availableToTrade[0],
                    liveActiveAsset.availableToTrade[1],
                  ).toFixed(),
                  currentPositionSize: livePosition?.szi,
                  leverage: desired.leverage,
                  orderType: 'limit',
                  referencePrice: price.toFixed(),
                  serverMaxBase:
                    liveActiveAsset.maxTradeSzs[command.side === 'buy' ? 0 : 1],
                  side: command.side,
                  szDecimals: market.marketData.szDecimals,
                }),
              )
            : null;
          const reduceDirectionInvalid =
            command.reduceOnly &&
            (!livePosition ||
              (command.side === 'buy'
                ? !new BigNumber(livePosition.szi).lt(0)
                : !new BigNumber(livePosition.szi).gt(0)));
          if (
            reduceDirectionInvalid ||
            !liveMaxBase ||
            baseSize.gt(liveMaxBase)
          ) {
            throw new Error(t('page.perps.pro.trade.insufficientBalance'));
          }
          const quoteAmount = baseSize.multipliedBy(price);
          const maximum = positive(market.marketData.maxUsdValueSize);
          if (
            quoteAmount.lt(PERPS_MINI_USD_VALUE) ||
            (maximum && quoteAmount.gt(maximum))
          ) {
            throw new Error(
              maximum && quoteAmount.gt(maximum)
                ? `Maximum amount is ${maximum.toFixed()}`
                : `Minimum amount is ${
                    resolvePerpsProMinimumOrderAmount({
                      minimumQuoteAmount: PERPS_MINI_USD_VALUE,
                      price: price.toFixed(),
                      szDecimals: market.marketData.szDecimals,
                    })?.displayQuoteAmount ?? PERPS_MINI_USD_VALUE
                  }`,
            );
          }
          executableCommand = finalizePerpsProBboOpenOrderCommand(
            command,
            price.toFixed(),
          );
        }
        const result = await executePerpsProOpenOrder(
          executableCommand,
          undefined,
          isSceneCurrent,
        );
        if (result.failureReason === 'userCancelled') return;
        if (result.failureReason === 'regionRestricted') {
          showToast(t('page.perps.regionNotSupport'), 'error');
          setReview(null);
          return;
        }
        if (result.kind === 'staleContext') {
          showToast(t('page.perps.pro.trade.contextChanged'), 'error');
          setReview(null);
          return;
        }
        if (result.kind === 'unknownOutcome') {
          showToast(t('page.perps.pro.trade.unknownOutcome'), 'error');
          return;
        }
        if (result.kind === 'failed')
          throw new Error(result.error || 'Order failed');
        showToast(
          t(
            result.kind === 'filled'
              ? 'page.perps.pro.trade.orderFilled'
              : 'page.perps.pro.trade.orderPlaced',
          ),
          'success',
        );
        amountDraftRef.current = createPerpsProTradeAmountDraft();
        amountOverflowToastActiveRef.current = false;
        amountSourceRef.current = 'manual';
        percentageRef.current = 0;
        patchForm({ amount: '' });
        setAmountSource('manual');
        setPercentageState(0);
        setReview(null);
        dirtyConfigurationRef.current = false;
        await refreshActiveAssetData().catch(error =>
          Sentry.captureException(error),
        );
      } catch (error) {
        if (isPerpsActionUserCancelled(error)) return;
        const message = error instanceof Error ? error.message : String(error);
        showToast(message || t('page.perps.pro.trade.orderFailed'), 'error');
        Sentry.captureException(
          error instanceof Error ? error : new Error(message),
          {
            extra: { scene: 'Perps Pro open order' },
          },
        );
      } finally {
        pendingRef.current = false;
        setPending(false);
      }
    },
    [
      accountFacts.account,
      accountIdentity,
      market,
      patchForm,
      refreshActiveAssetData,
      resolveLeverageExecutionReadiness,
      t,
      tradeConfigurationReady,
    ],
  );

  const ensureAttachedLeverage = useCallback(
    async (command: PerpsProAttachedTpSlCommand) => {
      const desired = command.reviewFacts;
      const commandAccountIdentity = getPerpsRuntimeIdentity(
        command.parent.account,
      );
      const leverageReadiness = await resolveLeverageExecutionReadiness({
        address: command.parent.account.address,
        coin: command.parent.coin,
        desired,
        expectedAccountIdentity: commandAccountIdentity,
        marketKey: command.parent.marketKey,
      });
      if (leverageReadiness === 'aligned') {
        return 'success' as const;
      }
      if (leverageReadiness === 'contextChanged') {
        return 'staleContext' as const;
      }
      const leverageCommand = buildPerpsUpdateLeverageCommand({
        account: command.parent.account,
        coin: command.parent.coin,
        isCross: desired.marginMode === 'cross',
        leverage: desired.leverage,
        maxLeverage: desired.maxLeverage,
      });
      const result = await executePerpsUpdateLeverage(leverageCommand);
      if (result.kind === 'success') {
        appliedConfigurationRef.current = {
          accountIdentity: commandAccountIdentity,
          leverage: desired.leverage,
          marginMode: desired.marginMode,
          marketKey: command.parent.marketKey,
        };
        return 'success' as const;
      }
      if (result.kind === 'staleContext') return 'staleContext' as const;
      return result.failureReason === 'userCancelled'
        ? ('userCancelled' as const)
        : ('failed' as const);
    },
    [resolveLeverageExecutionReadiness],
  );

  const executeAttachedReview = useCallback(
    async (command: PerpsProAttachedTpSlCommand) => {
      if (pendingRef.current || !tradeConfigurationReady) {
        return;
      }
      if (!perpsStore.getState().hasPermission) {
        showToast(t('page.perps.regionNotSupport'), 'error');
        setReview(null);
        return;
      }
      if (formRevisionRef.current !== command.reviewFacts.formRevision) {
        showToast(t('page.perps.pro.trade.contextChanged'), 'error');
        setReview(null);
        return;
      }
      pendingRef.current = true;
      setPending(true);
      try {
        const result = await executeAttachedTpSl(
          command,
          ensureAttachedLeverage,
        );
        if (result.kind === 'userCancelled') return;
        if (result.kind === 'staleContext') {
          showToast(
            t(
              result.reason === 'regionRestricted'
                ? 'page.perps.regionNotSupport'
                : 'page.perps.pro.trade.contextChanged',
            ),
            'error',
          );
          setReview(null);
          return;
        }
        if (result.kind === 'requestFailed') {
          showToast(
            result.reason === 'unresolvedSubmission'
              ? t('page.perps.pro.trade.attachedTpSlUnresolved')
              : result.error || t('page.perps.pro.trade.orderFailed'),
            'error',
          );
          return;
        }
        if (result.kind === 'parentRejected') {
          showToast(
            t('page.perps.pro.trade.attachedTpSlParentRejected'),
            'error',
          );
          return;
        }
        if (result.kind === 'unknownOutcome') {
          showToast(t('page.perps.pro.trade.attachedTpSlUnknown'), 'error');
          setReview(null);
          return;
        }
        if (result.kind === 'childRejected') {
          showToast(
            t('page.perps.pro.trade.attachedTpSlChildRejected'),
            'error',
          );
          setReview(null);
          return;
        }
        if (result.kind === 'partialOutcome') {
          showToast(t('page.perps.pro.trade.attachedTpSlPartial'), 'error');
          setReview(null);
          return;
        }
        showToast(
          t(
            result.refreshErrors.length || result.reconciliationErrors.length
              ? 'page.perps.pro.trade.attachedTpSlSubmittedRefreshDelayed'
              : 'page.perps.pro.trade.attachedTpSlSubmitted',
          ),
          'success',
        );
        amountDraftRef.current = createPerpsProTradeAmountDraft();
        amountOverflowToastActiveRef.current = false;
        amountSourceRef.current = 'manual';
        percentageRef.current = 0;
        patchForm({
          amount: '',
          attachedTpSl: createPerpsProAttachedTpSlDraft(
            tpSlModePreferences.opening,
          ),
        });
        setAmountSource('manual');
        setPercentageState(0);
        dirtyConfigurationRef.current = false;
        setReview(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showToast(message || t('page.perps.pro.trade.orderFailed'), 'error');
        Sentry.captureException(
          error instanceof Error ? error : new Error(message),
          { extra: { scene: 'Perps Pro attached TP/SL order' } },
        );
      } finally {
        pendingRef.current = false;
        setPending(false);
      }
    },
    [
      ensureAttachedLeverage,
      executeAttachedTpSl,
      patchForm,
      t,
      tpSlModePreferences.opening,
      tradeConfigurationReady,
    ],
  );

  const submitReview = useCallback(
    async (command: PerpsProAttachedTpSlCommand | PerpsProOpenOrderCommand) =>
      command.type === 'openOrderWithAttachedTpSl'
        ? executeAttachedReview(command)
        : execute(command),
    [execute, executeAttachedReview],
  );

  const requestReview = useCallback(
    async (side: PerpsProTradeSide) => {
      try {
        if (!tradeConfigurationReady) {
          return;
        }
        if (!perpsStore.getState().hasPermission) {
          showToast(t('page.perps.regionNotSupport'), 'error');
          return;
        }
        const command = buildReview(side);
        const orderType = getReviewParent(command).orderType;
        const skip = await perpsServiceApi.getSkipPerpsProTradeConfirmation(
          orderType,
        );
        if (!perpsStore.getState().hasPermission) {
          showToast(t('page.perps.regionNotSupport'), 'error');
          return;
        }
        setSkipConfirmation(skip);
        if (skip) {
          await submitReview(command);
        } else {
          setReview(command);
        }
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : String(error),
          'error',
        );
      }
    },
    [buildReview, submitReview, t, tradeConfigurationReady],
  );

  const confirmReview = useCallback(async () => {
    if (!review || !tradeConfigurationReady) {
      return;
    }
    if (!perpsStore.getState().hasPermission) {
      showToast(t('page.perps.regionNotSupport'), 'error');
      setReview(null);
      return;
    }
    if (skipConfirmation) {
      const orderType = getReviewParent(review).orderType;
      perpsServiceApi
        .setSkipPerpsProTradeConfirmation(orderType, true)
        .catch(error => {
          Sentry.captureException(error, {
            extra: { scene: 'Perps Pro trade confirmation preference' },
          });
        });
    }
    await submitReview(review);
  }, [review, skipConfirmation, submitReview, t, tradeConfigurationReady]);

  const availableQuote = scopedActiveAssetData
    ? BigNumber.min(
        scopedActiveAssetData.availableToTrade[0],
        scopedActiveAssetData.availableToTrade[1],
      ).toFixed()
    : '0';
  const amountUnitLabel =
    form.amountUnit === 'base'
      ? market?.displayBase ?? '-'
      : market?.quoteAsset ?? '-';
  const referenceMaxBase = BigNumber.max(
    getMaxBase('buy'),
    getMaxBase('sell'),
  ).toFixed();
  const resolvedAmount =
    amountSource === 'slider'
      ? resolvePerpsProSliderAmount({
          maxBase: referenceMaxBase,
          percentage,
          price: displayReferencePrice,
          szDecimals: market?.marketData.szDecimals ?? 0,
        })
      : resolvePerpsProTradeAmount({
          amount: form.amount,
          amountUnit: form.amountUnit,
          price: displayReferencePrice,
          szDecimals: market?.marketData.szDecimals ?? 0,
        });
  const showAmountConversion =
    amountSource === 'manual' && resolvedAmount != null;
  const getEstimatedLiquidationPrice = useCallback(
    (side: PerpsProTradeSide) => {
      if (!resolvedAmount || form.reduceOnly || !market) return null;
      const projection = getSideProjection(side);
      const entryPrice =
        form.orderType === 'conditional' &&
        form.conditionalExecution === 'market'
          ? market.marketData.markPx
          : form.orderType === 'market'
          ? getSideMarketOrderProjection(side)?.estimatedEntryPrice
          : getSideExecutionPrice(side);
      if (!projection || !entryPrice) return '--';
      const risk = resolvePerpsProProjectedTradeRisk({
        baseSize: projection.baseSize,
        calculateLiquidationPrice: calLiquidationPrice,
        crossMarginAvailableAfterMaintenance,
        currentPosition,
        entryPrice,
        leverage,
        marginMode,
        markPrice: market.marketData.markPx,
        maxLeverage: market.marketData.maxLeverage,
        pxDecimals: market.marketData.pxDecimals,
        side,
      });
      return risk?.liquidationPrice ?? '--';
    },
    [
      currentPosition,
      crossMarginAvailableAfterMaintenance,
      form.conditionalExecution,
      form.orderType,
      form.reduceOnly,
      getSideExecutionPrice,
      getSideMarketOrderProjection,
      getSideProjection,
      leverage,
      marginMode,
      market,
      resolvedAmount,
    ],
  );
  const estimatedLiquidation = useMemo(() => {
    if (!review || !market) return null;
    const parent = getReviewParent(review);
    const reviewFacts = review.reviewFacts;
    if (!reviewFacts) return null;
    if (parent.reduceOnly) return null;
    const bboEntryPrice =
      parent.execution.kind === 'bboLimit' &&
      bboStatus === 'ready' &&
      !!bboSessionKey &&
      parent.bboSessionKey === bboSessionKey
        ? resolvePerpsProBboPrice({
            isBuy: parent.side === 'buy',
            prices: bboPrices,
            strategy: parent.execution.strategy,
          })
        : null;
    const entryPrice =
      review.type === 'openOrderWithAttachedTpSl'
        ? review.attached.expectedEntryPrice
        : parent.execution.kind === 'bboLimit'
        ? bboEntryPrice
        : parent.execution.kind === 'limit' ||
          parent.execution.kind === 'conditionalLimit'
        ? parent.execution.limitPrice
        : parent.execution.kind === 'conditionalMarket'
        ? market.marketData.markPx
        : reviewFacts.marketFillRiskEntryPrice;
    if (!entryPrice) return null;
    const risk = resolvePerpsProProjectedTradeRisk({
      baseSize: parent.baseSize,
      calculateLiquidationPrice: calLiquidationPrice,
      crossMarginAvailableAfterMaintenance,
      currentPosition,
      entryPrice,
      leverage: reviewFacts.leverage,
      marginMode: reviewFacts.marginMode,
      markPrice: market.marketData.markPx,
      maxLeverage: reviewFacts.maxLeverage,
      pxDecimals: reviewFacts.pxDecimals,
      side: parent.side,
    });
    return risk ? { gap: risk.gap, price: risk.liquidationPrice } : null;
  }, [
    bboPrices,
    bboSessionKey,
    bboStatus,
    currentPosition,
    crossMarginAvailableAfterMaintenance,
    market,
    review,
  ]);

  return {
    amountDecimals,
    amountSource,
    amountUnit: form.amountUnit,
    amountUnitLabel,
    attachedTpSlExecutionEnabled: hasPerpsProAttachedTpSlExecutionCapability(),
    availableQuote,
    beginAmountEntry,
    closeReview: () => !pendingRef.current && setReview(null),
    confirmLeverage,
    confirmReview,
    disableBbo,
    enableBbo,
    form,
    hasPermission: accountFacts.hasPermission,
    getBboPrice,
    getCostDisplayAmount,
    getEstimatedLiquidationPrice,
    getMaxDisplayAmount,
    getSliderButtonDisplayAmount,
    estimatedLiquidation,
    leverage,
    leveragePending,
    marginMode,
    marginModeDisabledReason,
    market,
    patchForm,
    pending,
    percentage,
    priceFillFeedback,
    reduceOnlyAvailability,
    requestReview,
    resolvedAmount,
    showAmountConversion,
    review,
    setAmount,
    setConditionalExecution: (value: PerpsProConditionalExecution) =>
      patchForm({
        conditionalExecution: value,
        ...(value === 'market' ? { conditionalLimitPrice: '' } : {}),
      }),
    setMarginMode,
    setOrderType,
    setPercentage,
    setPrice,
    selectOrderBookPrice,
    setSkipConfirmation,
    setTif,
    skipConfirmation,
    tpSl,
    toggleAmountUnit,
    tradeConfigurationReady,
  };
};

export type PerpsProTradeController = ReturnType<typeof usePerpsProTrade>;
