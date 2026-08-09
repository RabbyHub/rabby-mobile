import { perpsServiceApi } from '@/core/serviceApi/perps';
import { isPerpsActionUserCancelled } from '@/hooks/perps/actions/actionError';
import { ensurePerpsActionApproval } from '@/hooks/perps/actions/perpsActionApproval';
import {
  buildPerpsUpdateLeverageCommand,
  executePerpsUpdateLeverage,
} from '@/hooks/perps/actions/updateLeverage';
import { showToast } from '@/hooks/perps/showToast';
import {
  getPerpsRuntimeIdentity,
  getPerpsRuntimeSnapshot,
} from '@/hooks/perps/runtime/perpsRuntimeState';
import {
  getPerpsAccountRuntimeContext,
  perpsStore,
} from '@/hooks/perps/usePerpsStore';
import {
  calLiquidationPrice,
  isPerpsMarketIsolatedOnly,
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
  type PerpsProOpenOrderCommand,
} from '../actions/openOrder';
import {
  buildPerpsProAttachedTpSlCommand,
  hasPerpsProAttachedTpSlExecutionCapability,
  type PerpsProAttachedTpSlCommand,
} from '../actions/openOrderWithAttachedTpSl';
import type { PerpsProBboPrices } from '../model/bbo';
import { resolvePerpsProBboPrice } from '../model/bbo';
import {
  resolvePerpsProInitialLeverage,
  type PerpsProLeverageConfiguration,
} from '../model/leverage';
import { estimatePerpsProMarketFill } from '../model/marketFillEstimate';
import type { PerpsProMarket } from '../model/market';
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
  resolvePerpsProTradeAmount,
  sanitizePerpsProDecimalInput,
  type PerpsProConditionalExecution,
  type PerpsProTradeOrderType,
  type PerpsProTradeSide,
  type PerpsProTradeTif,
} from '../model/trade';
import {
  getPerpsProMaxDisplayAmount,
  getPerpsProTradeDisplayReferencePrice,
  resolvePerpsProSliderAmount,
  resolvePerpsProTradeProjection,
} from '../model/tradeProjection';
import { resolvePerpsProProjectedTradeRisk } from '../model/tradeRisk';
import {
  clearPerpsProTpSlForMarketChange,
  usePerpsProTpSl,
} from './usePerpsProTpSl';
import { usePerpsProTradePreferences } from './usePerpsProTradePreferences';
import type { PerpsProLeverageUpdateRequest } from './usePerpsProLeverageUpdate';
import { usePerpsProAttachedTpSlExecution } from './usePerpsProAttachedTpSlExecution';

const positive = (value: unknown) => {
  const result = new BigNumber(
    (value as string | number | null | undefined) ?? Number.NaN,
  );
  return result.isFinite() && result.gt(0) ? result : null;
};

const tpSlErrorKey = ({ code }: PerpsProTpSlValidationError): string =>
  `page.perps.pro.trade.tpSlError.${code}`;

const getReviewParent = (
  review: PerpsProAttachedTpSlCommand | PerpsProOpenOrderCommand,
) => (review.type === 'openOrderWithAttachedTpSl' ? review.parent : review);

export const usePerpsProTrade = ({
  activeAssetData,
  bboBook,
  bboPrices,
  bboSessionKey,
  bboStatus,
  executionActive,
  leveragePending,
  market,
  zeroAddressLeverageBaseline = null,
  refreshActiveAssetData,
  updateLeverageRequest,
}: {
  activeAssetData: WsActiveAssetData | null;
  bboBook: L2Book | null;
  bboPrices: PerpsProBboPrices;
  bboSessionKey: string | null;
  bboStatus: 'error' | 'idle' | 'loading' | 'ready' | 'stale';
  executionActive: boolean;
  leveragePending: boolean;
  market: PerpsProMarket | null;
  zeroAddressLeverageBaseline?: PerpsProLeverageConfiguration | null;
  refreshActiveAssetData: () => Promise<unknown>;
  updateLeverageRequest: (
    request: PerpsProLeverageUpdateRequest,
  ) => Promise<boolean>;
}) => {
  const { t } = useTranslation();
  const preferences = usePerpsProTradePreferences();
  const tradeCoin = market?.canonicalCoin ?? '';
  const accountFacts = perpsStore(
    useShallow(state => ({
      account: state.currentPerpsAccount,
      crossMaintenanceMarginUsed:
        state.currentClearinghouseState?.crossMaintenanceMarginUsed ?? '0',
      crossMarginAccountValue:
        state.currentClearinghouseState?.crossMarginSummary.accountValue ?? '0',
      currentPosition:
        state.currentClearinghouseState?.assetPositions.find(
          item => item.position.coin === tradeCoin,
        )?.position ?? null,
      hasOpenOrders:
        !!tradeCoin && state.openOrders.some(order => order.coin === tradeCoin),
      isUserDataReady: state.isUserDataReady,
    })),
  );
  const [form, setForm] = useState(() =>
    createPerpsProTradeFormState({
      amountUnit: preferences.amountUnit,
      orderType: preferences.orderType,
    }),
  );
  const [marginMode, setMarginModeState] = useState<'cross' | 'isolated'>(
    'isolated',
  );
  const [leverage, setLeverageState] = useState(1);
  const [review, setReview] = useState<
    PerpsProAttachedTpSlCommand | PerpsProOpenOrderCommand | null
  >(null);
  const [pending, setPending] = useState(false);
  const [skipConfirmation, setSkipConfirmation] = useState(false);
  const [amountSource, setAmountSource] = useState<'manual' | 'slider'>(
    'manual',
  );
  const [percentage, setPercentageState] = useState(0);
  const amountDraftRef = useRef(createPerpsProTradeAmountDraft());
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
  const currentBboSessionKeyRef = useRef<string | null>(bboSessionKey);
  const currentBboStatusRef = useRef(bboStatus);
  currentMarketKeyRef.current = market?.marketKey ?? null;
  currentBboSessionKeyRef.current = bboSessionKey;
  currentBboStatusRef.current = bboStatus;

  const scopedActiveAssetData =
    activeAssetData &&
    accountFacts.account &&
    activeAssetData.coin === tradeCoin &&
    activeAssetData.user.toLowerCase() ===
      accountFacts.account.address.toLowerCase()
      ? activeAssetData
      : null;

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
  const initialLeverageConfiguration = useMemo(
    () =>
      resolvePerpsProInitialLeverage({
        marginModeConstraint: normalizePerpsMarketMarginMode(
          market?.marketData.marginMode,
          market?.marketData.onlyIsolated,
        ),
        maxLeverage: market?.marketData.maxLeverage ?? 1,
        position: hasCurrentPosition ? currentPosition?.leverage : null,
        zeroAddressBaseline: zeroAddressLeverageBaseline,
      }),
    [
      currentPosition?.leverage,
      hasCurrentPosition,
      market?.marketData.maxLeverage,
      market?.marketData.marginMode,
      market?.marketData.onlyIsolated,
      zeroAddressLeverageBaseline,
    ],
  );

  useEffect(() => {
    if (configurationAccountIdentityRef.current === accountIdentity) return;
    configurationAccountIdentityRef.current = accountIdentity;
    appliedConfigurationRef.current = null;
    dirtyConfigurationRef.current = false;
    setMarginModeState(initialLeverageConfiguration.type);
    setLeverageState(initialLeverageConfiguration.value);
    setReview(null);
  }, [accountIdentity, initialLeverageConfiguration]);

  useEffect(() => {
    if (!preferences.hydrated) return;
    setForm(current => ({
      ...current,
      amountUnit: preferences.amountUnit,
      orderType: preferences.orderType,
    }));
    setAmountSource('manual');
    setPercentageState(0);
  }, [preferences.amountUnit, preferences.hydrated, preferences.orderType]);

  useEffect(() => {
    const marketKey = market?.marketKey ?? null;
    if (marketKeyRef.current === marketKey) return;
    marketKeyRef.current = marketKey;
    appliedConfigurationRef.current = null;
    dirtyConfigurationRef.current = false;
    setMarginModeState(initialLeverageConfiguration.type);
    setLeverageState(initialLeverageConfiguration.value);
    amountDraftRef.current = createPerpsProTradeAmountDraft();
    setForm(current => ({
      ...current,
      amount: '',
      attachedTpSl: clearPerpsProTpSlForMarketChange(current.attachedTpSl),
      bboEnabled: false,
      conditionalLimitPrice: '',
      limitPrice: '',
      triggerPrice: '',
    }));
    setReview(null);
  }, [initialLeverageConfiguration, market]);

  useEffect(() => {
    const applied = appliedConfigurationRef.current;
    if (
      applied &&
      applied.accountIdentity === accountIdentity &&
      applied.marketKey === market?.marketKey
    ) {
      return;
    }
    if (dirtyConfigurationRef.current || !market) return;
    setMarginModeState(initialLeverageConfiguration.type);
    setLeverageState(initialLeverageConfiguration.value);
  }, [accountIdentity, initialLeverageConfiguration, market]);

  const patchForm = useCallback(
    (patch: Partial<typeof form>) =>
      setForm(current => ({ ...current, ...patch })),
    [],
  );
  const marketPrice =
    market?.marketData.midPx || market?.marketData.markPx || '';
  const displayReferencePrice = getPerpsProTradeDisplayReferencePrice({
    form,
    marketPrice,
  });
  const amountDecimals = getPerpsProAmountInputDecimals({
    amountUnit: form.amountUnit,
    szDecimals: market?.marketData.szDecimals ?? 0,
  });
  const setAmount = useCallback(
    (value: string) => {
      if (!/^\d*\.?\d*$/u.test(value)) return;
      const amount = sanitizePerpsProDecimalInput(value, amountDecimals);
      amountDraftRef.current = updatePerpsProTradeAmountDraft({
        amount,
        amountUnit: form.amountUnit,
        price: displayReferencePrice,
        szDecimals: market?.marketData.szDecimals ?? 0,
      });
      setAmountSource('manual');
      setPercentageState(0);
      patchForm({ amount });
    },
    [
      amountDecimals,
      displayReferencePrice,
      form.amountUnit,
      market?.marketData.szDecimals,
      patchForm,
    ],
  );
  const beginAmountEntry = useCallback(() => {
    if (amountSource !== 'slider') return;
    amountDraftRef.current = createPerpsProTradeAmountDraft();
    setAmountSource('manual');
    setPercentageState(0);
    patchForm({ amount: '' });
  }, [amountSource, patchForm]);
  const setPrice = useCallback(
    (
      field: 'conditionalLimitPrice' | 'limitPrice' | 'triggerPrice',
      value: string,
    ) => {
      if (!/^\d*\.?\d*$/u.test(value)) return;
      patchForm({
        [field]: sanitizePerpsProDecimalInput(
          value,
          market?.marketData.pxDecimals ?? 2,
        ),
      });
    },
    [market?.marketData.pxDecimals, patchForm],
  );
  const selectManualLimitPrice = useCallback(
    (price: string, sourceMarketKey: string) => {
      if (
        !positive(price) ||
        form.orderType !== 'limit' ||
        form.bboEnabled ||
        sourceMarketKey !== currentMarketKeyRef.current
      ) {
        return;
      }
      setPrice('limitPrice', price);
    },
    [form.bboEnabled, form.orderType, setPrice],
  );
  const setOrderType = useCallback(
    (orderType: PerpsProTradeOrderType) => {
      patchForm({ orderType });
      void preferences.setOrderType(orderType);
    },
    [patchForm, preferences],
  );
  const toggleAmountUnit = useCallback(() => {
    const next = form.amountUnit === 'quote' ? 'base' : 'quote';
    let nextAmount = amountSource === 'slider' ? `${percentage}%` : '';
    if (amountSource === 'manual') {
      amountDraftRef.current = repricePerpsProTradeAmountDraft({
        draft: amountDraftRef.current,
        price: displayReferencePrice,
        szDecimals: market?.marketData.szDecimals ?? 0,
      });
      nextAmount = getPerpsProTradeAmountDraftDisplay(
        amountDraftRef.current,
        next,
      );
    }
    patchForm({ amount: nextAmount, amountUnit: next });
    void preferences.setAmountUnit(next);
  }, [
    amountSource,
    displayReferencePrice,
    form.amountUnit,
    market?.marketData.szDecimals,
    patchForm,
    percentage,
    preferences,
  ]);

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
    setForm(current =>
      current.amount === nextAmount
        ? current
        : { ...current, amount: nextAmount },
    );
  }, [
    amountSource,
    displayReferencePrice,
    form.amountUnit,
    market?.marketData.szDecimals,
  ]);

  const marketMarginMode = market?.marketData.marginMode;
  const marketOnlyIsolated = market?.marketData.onlyIsolated;
  const marginModeDisabledReason = useMemo(() => {
    if (
      isPerpsMarketIsolatedOnly({
        marginMode: marketMarginMode,
        onlyIsolated: marketOnlyIsolated,
      })
    ) {
      return 'onlyIsolated' as const;
    }
    if (new BigNumber(currentPosition?.szi ?? 0).abs().gt(0) || hasOpenOrders) {
      return 'existingExposure' as const;
    }
    return null;
  }, [
    currentPosition?.szi,
    hasOpenOrders,
    marketMarginMode,
    marketOnlyIsolated,
  ]);
  const setMarginMode = useCallback(
    (next: 'cross' | 'isolated') => {
      if (next === marginMode) return;
      if (marginModeDisabledReason) {
        showToast(t('page.perps.pro.trade.marginModeUnavailable'), 'error');
        return;
      }
      dirtyConfigurationRef.current = true;
      setMarginModeState(next);
    },
    [marginMode, marginModeDisabledReason, t],
  );
  const confirmLeverage = useCallback(
    async (next: number) => {
      if (
        !accountFacts.account ||
        !accountIdentity ||
        !market ||
        leveragePending
      )
        return false;
      const max = Math.max(1, market.marketData.maxLeverage);
      const normalized = Math.min(max, Math.max(1, Math.round(next)));
      const success = await updateLeverageRequest({
        account: accountFacts.account,
        coin: market.canonicalCoin,
        currentIsCross: scopedActiveAssetData?.leverage.type === 'cross',
        currentLeverage: scopedActiveAssetData?.leverage.value ?? 0,
        isCross: marginMode === 'cross',
        leverage: normalized,
        maxLeverage: max,
      });
      if (!success) return false;
      setLeverageState(normalized);
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
      leveragePending,
      marginMode,
      market,
      scopedActiveAssetData?.leverage.type,
      scopedActiveAssetData?.leverage.value,
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
        const sideDisabled =
          side === 'buy'
            ? reduceOnlyAvailability.buyDisabled
            : reduceOnlyAvailability.sellDisabled;
        return sideDisabled
          ? new BigNumber(0)
          : new BigNumber(currentPosition?.szi ?? 0).abs();
      }
      return (
        positive(scopedActiveAssetData?.maxTradeSzs[side === 'buy' ? 0 : 1]) ??
        new BigNumber(0)
      );
    },
    [
      currentPosition?.szi,
      form.reduceOnly,
      reduceOnlyAvailability.buyDisabled,
      reduceOnlyAvailability.sellDisabled,
      scopedActiveAssetData?.maxTradeSzs,
    ],
  );
  const getMaxDisplayAmount = useCallback(
    (side: PerpsProTradeSide) =>
      getPerpsProMaxDisplayAmount({
        amountUnit: form.amountUnit,
        executionPrice: getSideExecutionPrice(side),
        maxBase: getMaxBase(side).toFixed(),
      }),
    [form.amountUnit, getMaxBase, getSideExecutionPrice],
  );
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
  const getCostDisplayAmount = useCallback(
    (side: PerpsProTradeSide) => getSideProjection(side)?.costQuote ?? '0',
    [getSideProjection],
  );
  const setPercentage = useCallback(
    (percent: number) => {
      const next = Math.max(0, Math.min(100, percent));
      setAmountSource(next === 0 ? 'manual' : 'slider');
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
      if (!market || form.orderType === 'conditional' || form.bboEnabled) {
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
    (attachedTpSl: PerpsProAttachedTpSlDraft) => patchForm({ attachedTpSl }),
    [patchForm],
  );
  const tpSl = usePerpsProTpSl({
    draft: form.attachedTpSl,
    leverage,
    onChange: patchAttachedTpSl,
    order: form,
    previewFacts: tpSlPreviewFacts,
    pxDecimals: market?.marketData.pxDecimals ?? 2,
    szDecimals: market?.marketData.szDecimals ?? 0,
  });
  const setTpSlSubmitErrors = tpSl.setSubmitErrors;

  const buildReview = useCallback(
    (side: PerpsProTradeSide) => {
      if (!accountFacts.account || !market) {
        throw new Error(t('page.perps.pro.trade.accountRequired'));
      }
      const commandForm = getCommandForm(side);
      const hasAttached = commandForm.attachedTpSl.enabled;
      let expectedEntryPrice =
        market.marketData.midPx || market.marketData.markPx;
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
          setTpSlSubmitErrors([error]);
          throw new Error(t(tpSlErrorKey(error)));
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
          setTpSlSubmitErrors([error]);
          throw new Error(t(tpSlErrorKey(error)));
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
        bboPrice: getBboPrice(side),
        bboSessionKey,
        bestAsk: bboPrices.asks1,
        bestBid: bboPrices.bids1,
        coin: market.canonicalCoin,
        dexId: market.marketData.dexId,
        form: parentForm,
        marketKey: market.marketKey,
        marketPrice: expectedEntryPrice,
        maxUsdValueSize: market.marketData.maxUsdValueSize,
        side,
        szDecimals: market.marketData.szDecimals,
      });
      const maxBase = getMaxBase(side);
      if (!maxBase.gt(0) || new BigNumber(command.baseSize).gt(maxBase)) {
        throw new Error(t('page.perps.pro.trade.insufficientBalance'));
      }
      if (form.reduceOnly) {
        const signedSize = positive(
          new BigNumber(currentPosition?.szi ?? 0).abs(),
        );
        const sideDisabled =
          side === 'buy'
            ? reduceOnlyAvailability.buyDisabled
            : reduceOnlyAvailability.sellDisabled;
        if (
          sideDisabled ||
          !signedSize ||
          new BigNumber(command.baseSize).gt(signedSize)
        ) {
          throw new Error(t('page.perps.pro.trade.reduceOnlyUnavailable'));
        }
      }
      if (!hasAttached) {
        setTpSlSubmitErrors([]);
        return command;
      }
      if (command.execution.kind === 'limit') {
        expectedEntryPrice = command.execution.limitPrice;
      }
      const risk = resolvePerpsProProjectedTradeRisk({
        baseSize: command.baseSize,
        calculateLiquidationPrice: calLiquidationPrice,
        crossMarginAccountValue: accountFacts.crossMarginAccountValue,
        crossMaintenanceMarginUsed: accountFacts.crossMaintenanceMarginUsed,
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
      setTpSlSubmitErrors(evaluation.errors);
      if (evaluation.errors.length > 0) {
        throw new Error(t(tpSlErrorKey(evaluation.errors[0])));
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
        leverage,
        liquidationGap: risk?.gap ?? null,
        marginMode,
        markPrice: market.marketData.markPx,
        maxLeverage: market.marketData.maxLeverage,
        marketSnapshot: {
          ...marketSnapshot,
          normalizedBaseSize: command.baseSize,
        },
        parent: command,
        position: currentPosition,
        pxDecimals: market.marketData.pxDecimals,
        quoteAsset: market.quoteAsset,
        runtime: getPerpsRuntimeSnapshot(),
        szDecimals: market.marketData.szDecimals,
      });
    },
    [
      accountFacts.account,
      accountFacts.crossMaintenanceMarginUsed,
      accountFacts.crossMarginAccountValue,
      bboBook,
      bboPrices.asks1,
      bboPrices.bids1,
      bboSessionKey,
      bboStatus,
      currentPosition,
      form,
      getBboPrice,
      getCommandForm,
      getMaxBase,
      leverage,
      marginMode,
      market,
      reduceOnlyAvailability.buyDisabled,
      reduceOnlyAvailability.sellDisabled,
      setTpSlSubmitErrors,
      t,
    ],
  );

  const execute = useCallback(
    async (command: PerpsProOpenOrderCommand) => {
      if (
        pendingRef.current ||
        !accountFacts.account ||
        !accountIdentity ||
        !market
      )
        return;
      const isSceneCurrent = () =>
        currentMarketKeyRef.current === command.marketKey &&
        (!command.bboSessionKey ||
          currentBboSessionKeyRef.current === command.bboSessionKey);
      if (!isSceneCurrent()) {
        showToast(t('page.perps.pro.trade.contextChanged'), 'error');
        setReview(null);
        return;
      }
      pendingRef.current = true;
      setPending(true);
      try {
        await ensurePerpsActionApproval(accountFacts.account);
        if (!isSceneCurrent()) {
          showToast(t('page.perps.pro.trade.contextChanged'), 'error');
          setReview(null);
          return;
        }
        const activeLeverage = scopedActiveAssetData?.leverage;
        const appliedConfiguration = appliedConfigurationRef.current;
        if (
          (activeLeverage?.type !== marginMode ||
            activeLeverage?.value !== leverage) &&
          !(
            appliedConfiguration?.marketKey === market.marketKey &&
            appliedConfiguration.accountIdentity === accountIdentity &&
            appliedConfiguration.marginMode === marginMode &&
            appliedConfiguration.leverage === leverage
          )
        ) {
          const leverageCommand = buildPerpsUpdateLeverageCommand({
            account: accountFacts.account,
            coin: market.canonicalCoin,
            isCross: marginMode === 'cross',
            leverage,
            maxLeverage: market.marketData.maxLeverage,
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
            leverage,
            marginMode,
            marketKey: market.marketKey,
          };
        }
        const result = await executePerpsProOpenOrder(
          command,
          undefined,
          isSceneCurrent,
        );
        if (result.failureReason === 'userCancelled') return;
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
      leverage,
      marginMode,
      market,
      patchForm,
      refreshActiveAssetData,
      scopedActiveAssetData?.leverage,
      t,
    ],
  );

  const requestReview = useCallback(
    async (side: PerpsProTradeSide) => {
      try {
        const command = buildReview(side);
        if (command.type === 'openOrderWithAttachedTpSl') {
          setSkipConfirmation(false);
          setReview(command);
          return;
        }
        const skip = await perpsServiceApi.getSkipPerpsProTradeConfirmation(
          form.orderType,
        );
        setSkipConfirmation(skip);
        if (skip) {
          await execute(command);
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
    [buildReview, execute, form.orderType],
  );

  const ensureAttachedLeverage = useCallback(
    async (command: PerpsProAttachedTpSlCommand) => {
      const desired = command.reviewFacts;
      const commandAccountIdentity = getPerpsRuntimeIdentity(
        command.parent.account,
      );
      const activeLeverage = scopedActiveAssetData?.leverage;
      const appliedConfiguration = appliedConfigurationRef.current;
      if (
        activeLeverage?.type === desired.marginMode &&
        activeLeverage?.value === desired.leverage
      ) {
        return 'success' as const;
      }
      if (
        appliedConfiguration?.marketKey === command.parent.marketKey &&
        appliedConfiguration.accountIdentity === commandAccountIdentity &&
        appliedConfiguration.marginMode === desired.marginMode &&
        appliedConfiguration.leverage === desired.leverage
      ) {
        return 'success' as const;
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
    [scopedActiveAssetData?.leverage],
  );

  const confirmReview = useCallback(async () => {
    if (!review) return;
    if (review.type === 'openOrderWithAttachedTpSl') {
      if (pendingRef.current) return;
      pendingRef.current = true;
      setPending(true);
      try {
        const result = await executeAttachedTpSl(
          review,
          ensureAttachedLeverage,
        );
        if (result.kind === 'userCancelled') return;
        if (result.kind === 'staleContext') {
          showToast(t('page.perps.pro.trade.contextChanged'), 'error');
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
        patchForm({
          amount: '',
          attachedTpSl: createPerpsProAttachedTpSlDraft(),
        });
        setAmountSource('manual');
        setPercentageState(0);
        dirtyConfigurationRef.current = false;
        setReview(null);
      } finally {
        pendingRef.current = false;
        setPending(false);
      }
      return;
    }
    if (skipConfirmation) {
      perpsServiceApi
        .setSkipPerpsProTradeConfirmation(review.orderType, true)
        .catch(error => {
          Sentry.captureException(error, {
            extra: { scene: 'Perps Pro trade confirmation preference' },
          });
        });
    }
    await execute(review);
  }, [
    ensureAttachedLeverage,
    executeAttachedTpSl,
    execute,
    patchForm,
    review,
    skipConfirmation,
    t,
  ]);

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
  const getEstimatedLiquidationPrice = useCallback(
    (side: PerpsProTradeSide) => {
      if (!resolvedAmount || form.reduceOnly || !market) return null;
      const projection = getSideProjection(side);
      const entryPrice =
        form.orderType === 'conditional' &&
        form.conditionalExecution === 'market'
          ? form.triggerPrice
          : getSideExecutionPrice(side);
      if (!projection || !entryPrice) return '--';
      const risk = resolvePerpsProProjectedTradeRisk({
        baseSize: projection.baseSize,
        calculateLiquidationPrice: calLiquidationPrice,
        crossMarginAccountValue: accountFacts.crossMarginAccountValue,
        crossMaintenanceMarginUsed: accountFacts.crossMaintenanceMarginUsed,
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
      accountFacts.crossMaintenanceMarginUsed,
      accountFacts.crossMarginAccountValue,
      currentPosition,
      form.conditionalExecution,
      form.orderType,
      form.reduceOnly,
      form.triggerPrice,
      getSideExecutionPrice,
      getSideProjection,
      leverage,
      marginMode,
      market,
      resolvedAmount,
    ],
  );
  const estimatedLiquidation = useMemo(() => {
    if (!review || !market) return null;
    if (review.type === 'openOrderWithAttachedTpSl') {
      return review.reviewFacts.liquidationPrice != null &&
        review.reviewFacts.liquidationGap != null
        ? {
            gap: review.reviewFacts.liquidationGap,
            price: review.reviewFacts.liquidationPrice,
          }
        : null;
    }
    const parent = getReviewParent(review);
    if (parent.reduceOnly) return null;
    const entryPrice =
      parent.execution.kind === 'limit' ||
      parent.execution.kind === 'conditionalLimit'
        ? parent.execution.limitPrice
        : parent.execution.kind === 'conditionalMarket'
        ? parent.execution.triggerPrice
        : market.marketData.markPx;
    const risk = resolvePerpsProProjectedTradeRisk({
      baseSize: parent.baseSize,
      calculateLiquidationPrice: calLiquidationPrice,
      crossMarginAccountValue: accountFacts.crossMarginAccountValue,
      crossMaintenanceMarginUsed: accountFacts.crossMaintenanceMarginUsed,
      currentPosition,
      entryPrice,
      leverage,
      marginMode,
      markPrice: market.marketData.markPx,
      maxLeverage: market.marketData.maxLeverage,
      pxDecimals: market.marketData.pxDecimals,
      side: parent.side,
    });
    return risk ? { gap: risk.gap, price: risk.liquidationPrice } : null;
  }, [
    accountFacts.crossMaintenanceMarginUsed,
    accountFacts.crossMarginAccountValue,
    currentPosition,
    leverage,
    marginMode,
    market,
    review,
  ]);

  return {
    amountUnit: form.amountUnit,
    amountUnitLabel,
    attachedTpSlExecutionEnabled: hasPerpsProAttachedTpSlExecutionCapability(),
    availableQuote,
    beginAmountEntry,
    closeReview: () => !pendingRef.current && setReview(null),
    confirmLeverage,
    confirmReview,
    form,
    getBboPrice,
    getCostDisplayAmount,
    getEstimatedLiquidationPrice,
    getMaxDisplayAmount,
    estimatedLiquidation,
    leverage,
    leveragePending,
    marginMode,
    marginModeDisabledReason,
    market,
    patchForm,
    pending,
    percentage,
    reduceOnlyAvailability,
    requestReview,
    resolvedAmount,
    review,
    setAmount,
    setConditionalExecution: (value: PerpsProConditionalExecution) =>
      patchForm({ conditionalExecution: value }),
    setMarginMode,
    setOrderType,
    setPercentage,
    setPrice,
    selectManualLimitPrice,
    setSkipConfirmation,
    setTif: (tif: PerpsProTradeTif) => patchForm({ tif }),
    skipConfirmation,
    tpSl,
    toggleAmountUnit,
  };
};

export type PerpsProTradeController = ReturnType<typeof usePerpsProTrade>;
