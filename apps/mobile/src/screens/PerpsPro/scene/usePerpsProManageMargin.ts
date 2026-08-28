import type { Account } from '@/core/startupServices/preference';
import { ensurePerpsActionApproval } from '@/hooks/perps/actions/perpsActionApproval';
import { isPerpsActionUserCancelled } from '@/hooks/perps/actions/actionError';
import {
  buildPerpsUpdateIsolatedMarginCommand,
  executePerpsUpdateIsolatedMargin,
} from '@/hooks/perps/actions/updateIsolatedMargin';
import {
  fetchClearinghouseStateHttp,
  fetchSpotStateHttp,
  isPerpsUserAbstractionReadyForAccount,
  perpsStore,
  type PerpsState,
} from '@/hooks/perps/usePerpsStore';
import {
  judgeIsBuilderFeeNeedApprove,
  judgeIsUserAgentIsExpired,
} from '@/hooks/perps/perpsActionError';
import { getPerpsRuntimeIdentity } from '@/hooks/perps/runtime/perpsRuntimeState';
import { showToast } from '@/hooks/perps/showToast';
import * as Sentry from '@sentry/react-native';
import BigNumber from 'bignumber.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';

import { buildPerpsProMarketDescriptor } from '../model/market';
import type { PerpsPositionViewModel } from '../model/position';
import {
  buildPositionMarginRange,
  buildPositionMarginRiskProjection,
  formatPositionMarginTarget,
  resolvePositionMarginAvailable,
  resolvePositionMarginCurrentRisk,
  validatePositionMarginTarget,
  type PositionMarginRange,
  type PositionMarginTargetState,
} from '../model/positionMargin';
import { getPerpsProCollateralToken } from '../model/tradeRiskAccount';

type ManageMarginEditor = Readonly<{
  accountIdentity: string;
  coin: string;
  expectedSignedSize: string;
  openingPosition: PerpsPositionViewModel;
}>;

const EMPTY_FACTS = Object.freeze({
  account: null,
  clearinghouseState: null,
  hasPermission: false,
  isSpotStateReady: false,
  isUserDataReady: false,
  market: undefined,
  portfolioAvailableAfterMaintenance: null,
  spotQuoteAvailable: null,
  userAbstraction: 'default',
  userAbstractionReady: false,
});

const selectManageMarginFacts = (state: PerpsState, coin: string) => {
  if (!coin) {
    return EMPTY_FACTS;
  }
  const market = state.marketDataMap[coin];
  const collateralToken = getPerpsProCollateralToken(market?.quoteAsset);
  return {
    account: state.currentPerpsAccount,
    clearinghouseState: state.currentClearinghouseState,
    hasPermission: state.hasPermission,
    isSpotStateReady: state.isSpotStateReady,
    isUserDataReady: state.isUserDataReady,
    market,
    portfolioAvailableAfterMaintenance:
      collateralToken == null
        ? null
        : state.spotState.tokenToAvailableAfterMaintenance?.find(
            ([token]) => Number(token) === collateralToken,
          )?.[1] ?? null,
    spotQuoteAvailable:
      collateralToken == null
        ? null
        : state.spotState.rawBalancesByToken[collateralToken]?.available ??
          null,
    userAbstraction: state.userAbstraction,
    userAbstractionReady: isPerpsUserAbstractionReadyForAccount(state),
  };
};

const readLivePosition = (state: PerpsState, coin: string) =>
  state.currentClearinghouseState?.assetPositions.find(
    item => item.position.coin === coin,
  )?.position ?? null;

const isSpotCollateralAccount = (userAbstraction: string) =>
  userAbstraction === 'unifiedAccount' || userAbstraction === 'portfolioMargin';

const buildManageMarginRange = (
  facts: ReturnType<typeof selectManageMarginFacts>,
  position: ReturnType<typeof readLivePosition>,
) => {
  const market = facts.market;
  if (!market || !position) {
    return null;
  }
  const available = resolvePositionMarginAvailable({
    accountFactsReady: facts.isUserDataReady,
    dexWithdrawable:
      facts.clearinghouseState?.perDexSummaries[market.dexId || '']
        ?.withdrawable,
    isSpotStateReady: facts.isSpotStateReady,
    portfolioAvailableAfterMaintenance:
      facts.portfolioAvailableAfterMaintenance,
    quoteAsset: market.quoteAsset,
    spotQuoteAvailable: facts.spotQuoteAvailable,
    userAbstraction: facts.userAbstraction,
    userAbstractionReady: facts.userAbstractionReady,
  });
  return buildPositionMarginRange({
    available,
    currentMargin: position.marginUsed,
    leverage: position.leverage?.value,
    marginModeConstraint:
      market.marginMode ?? (market.onlyIsolated ? 'strictIsolated' : null),
    markPrice: market.markPx,
    positionSize: position.szi,
  });
};

const refreshManageMarginFacts = async ({
  accountAddress,
  dexId,
  userAbstraction,
}: {
  accountAddress: string;
  dexId: string;
  userAbstraction: string;
}) => {
  const initiallyNeedsSpot = isSpotCollateralAccount(userAbstraction);
  const [clearinghouseReady, initialSpotReady] = await Promise.all([
    fetchClearinghouseStateHttp(dexId, accountAddress),
    initiallyNeedsSpot
      ? fetchSpotStateHttp(accountAddress).catch(() => false)
      : Promise.resolve(true),
  ]);
  if (!clearinghouseReady || !initialSpotReady) {
    return false;
  }
  if (
    !initiallyNeedsSpot &&
    isSpotCollateralAccount(perpsStore.getState().userAbstraction)
  ) {
    return fetchSpotStateHttp(accountAddress).catch(() => false);
  }
  return true;
};

export interface PerpsProManageMarginView {
  currentLiquidationDistance: string | null;
  currentLiquidationPrice: string | null;
  currentMargin: string;
  direction: 'long' | 'short';
  displayPair: string;
  entryPrice: string | null;
  leverage: number;
  markPrice: string | null;
  projectedLiquidationDistance: string | null;
  projectedLiquidationPrice: string | null;
  pxDecimals: number;
  quoteAsset: 'USDC' | 'USDT' | 'USDH' | 'USDE';
  range: PositionMarginRange | null;
  sourceTag: string | null;
  targetState: PositionMarginTargetState;
}

export const usePerpsProManageMargin = () => {
  const { t } = useTranslation();
  const [editor, setEditor] = useState<ManageMarginEditor | null>(null);
  const [draft, setDraft] = useState('');
  const [dirty, setDirty] = useState(false);
  const [userOwned, setUserOwned] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const coin = editor?.coin ?? '';
  const facts = perpsStore(
    useShallow(state => selectManageMarginFacts(state, coin)),
  );
  const livePosition = useMemo(
    () =>
      facts.clearinghouseState?.assetPositions.find(
        item => item.position.coin === coin,
      )?.position ?? null,
    [coin, facts.clearinghouseState?.assetPositions],
  );

  const resetEditor = useCallback(() => {
    setEditor(null);
    setDraft('');
    setDirty(false);
    setUserOwned(false);
  }, []);
  const close = useCallback(() => {
    if (pendingRef.current) {
      return;
    }
    resetEditor();
  }, [resetEditor]);

  const open = useCallback((position: PerpsPositionViewModel) => {
    const state = perpsStore.getState();
    const account = state.currentPerpsAccount;
    const live = readLivePosition(state, position.coin);
    const signedSize = new BigNumber(live?.szi ?? Number.NaN);
    if (
      position.marginMode !== 'isolated' ||
      !account ||
      live?.leverage?.type !== 'isolated' ||
      !signedSize.isFinite() ||
      signedSize.isZero()
    ) {
      return;
    }
    const initialDraft =
      formatPositionMarginTarget(live.marginUsed ?? position.margin) ?? '';
    setEditor(
      Object.freeze({
        accountIdentity: getPerpsRuntimeIdentity(account),
        coin: position.coin,
        expectedSignedSize: signedSize.toFixed(),
        openingPosition: position,
      }),
    );
    setDraft(initialDraft);
    setDirty(false);
    setUserOwned(false);
  }, []);

  useEffect(() => {
    if (!editor || userOwned || !livePosition) {
      return;
    }
    const next = formatPositionMarginTarget(livePosition.marginUsed);
    if (next != null) {
      setDraft(current => (current === next ? current : next));
    }
  }, [editor, livePosition, userOwned]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const accountIdentity = facts.account
      ? getPerpsRuntimeIdentity(facts.account)
      : null;
    const signedSize = new BigNumber(livePosition?.szi ?? Number.NaN);
    if (
      accountIdentity !== editor.accountIdentity ||
      livePosition?.leverage?.type !== 'isolated' ||
      !signedSize.isFinite() ||
      signedSize.isZero() ||
      !signedSize.eq(editor.expectedSignedSize)
    ) {
      resetEditor();
    }
  }, [editor, facts.account, livePosition, resetEditor]);

  const range = useMemo(
    () => buildManageMarginRange(facts, livePosition),
    [facts, livePosition],
  );
  const targetState = validatePositionMarginTarget({ range, target: draft });

  const view = useMemo<PerpsProManageMarginView | null>(() => {
    const market = facts.market;
    const position = livePosition;
    if (!editor || !market || !position) {
      return null;
    }
    const signedSize = new BigNumber(position.szi ?? Number.NaN);
    const direction = signedSize.gte(0) ? 'long' : 'short';
    const descriptor = buildPerpsProMarketDescriptor(market);
    const currentRisk = resolvePositionMarginCurrentRisk({
      direction,
      liquidationPrice: position.liquidationPx,
      margin: position.marginUsed,
      markPrice: market.markPx,
      positionSize: signedSize.abs().toFixed(),
      tiers: market.maintenanceMarginTiers,
    });
    const projection =
      targetState === 'noChange'
        ? currentRisk
        : buildPositionMarginRiskProjection({
            direction,
            margin: draft,
            markPrice: market.markPx,
            positionSize: signedSize.abs().toFixed(),
            tiers: market.maintenanceMarginTiers,
          });
    return {
      currentLiquidationDistance: currentRisk?.liquidationDistance ?? null,
      currentLiquidationPrice: currentRisk?.liquidationPrice ?? null,
      currentMargin: String(position.marginUsed ?? '0'),
      direction,
      displayPair: descriptor.displayPair,
      entryPrice: position.entryPx || null,
      leverage: Number(position.leverage?.value) || 0,
      markPrice: market.markPx || null,
      projectedLiquidationDistance: projection?.liquidationDistance ?? null,
      projectedLiquidationPrice: projection?.liquidationPrice ?? null,
      pxDecimals: market.pxDecimals,
      quoteAsset: market.quoteAsset,
      range,
      sourceTag: descriptor.sourceTag,
      targetState,
    };
  }, [draft, editor, facts.market, livePosition, range, targetState]);

  const beginEditing = useCallback(() => setUserOwned(true), []);
  const changeDraft = useCallback((value: string) => {
    setUserOwned(true);
    setDirty(true);
    setDraft(value);
  }, []);
  const selectTarget = useCallback((value: string) => {
    setUserOwned(true);
    setDirty(true);
    setDraft(value);
  }, []);

  const confirm = useCallback(async () => {
    const activeEditor = editorRef.current;
    if (
      pendingRef.current ||
      !activeEditor ||
      !dirty ||
      targetState !== 'valid'
    ) {
      return;
    }
    const openingAccount = perpsStore.getState().currentPerpsAccount;
    const openingState = perpsStore.getState();
    if (
      !openingAccount ||
      getPerpsRuntimeIdentity(openingAccount) !== activeEditor.accountIdentity
    ) {
      resetEditor();
      showToast(t('page.perps.pro.positions.marginContextChanged'), 'error');
      return;
    }
    if (!openingState.hasPermission) {
      showToast(t('page.perps.regionNotSupport'), 'error');
      return;
    }
    pendingRef.current = true;
    setPending(true);
    try {
      await ensurePerpsActionApproval(openingAccount as Account, {
        builderFee: false,
      });
      const beforeRefresh = perpsStore.getState();
      const beforeRefreshAccount = beforeRefresh.currentPerpsAccount;
      const beforeRefreshMarket =
        beforeRefresh.marketDataMap[activeEditor.coin];
      if (
        !beforeRefreshAccount ||
        !beforeRefreshMarket ||
        getPerpsRuntimeIdentity(beforeRefreshAccount) !==
          activeEditor.accountIdentity
      ) {
        resetEditor();
        showToast(t('page.perps.pro.positions.marginContextChanged'), 'error');
        return;
      }
      const refreshed = await refreshManageMarginFacts({
        accountAddress: beforeRefreshAccount.address,
        dexId: beforeRefreshMarket.dexId || '',
        userAbstraction: beforeRefresh.userAbstraction,
      });
      if (!refreshed) {
        showToast(t('page.perps.pro.positions.marginRefreshFailed'), 'error');
        return;
      }
      const state = perpsStore.getState();
      const account = state.currentPerpsAccount;
      const position = readLivePosition(state, activeEditor.coin);
      const market = state.marketDataMap[activeEditor.coin];
      const signedSize = new BigNumber(position?.szi ?? Number.NaN);
      if (
        !account ||
        !market ||
        !position ||
        !state.hasPermission ||
        getPerpsRuntimeIdentity(account) !== activeEditor.accountIdentity ||
        position.leverage?.type !== 'isolated' ||
        !signedSize.isFinite() ||
        signedSize.isZero() ||
        !signedSize.eq(activeEditor.expectedSignedSize)
      ) {
        resetEditor();
        showToast(
          state.hasPermission
            ? t('page.perps.pro.positions.marginContextChanged')
            : t('page.perps.regionNotSupport'),
          'error',
        );
        return;
      }
      const latestRange = buildManageMarginRange(
        selectManageMarginFacts(state, activeEditor.coin),
        position,
      );
      const latestTargetState = validatePositionMarginTarget({
        range: latestRange,
        target: draft,
      });
      if (latestTargetState === 'noChange') {
        resetEditor();
        showToast(t('page.perps.pro.positions.marginUpdated'), 'success');
        return;
      }
      if (
        latestTargetState === 'aboveMax' ||
        latestTargetState === 'belowMin'
      ) {
        return;
      }
      if (latestTargetState !== 'valid') {
        resetEditor();
        showToast(t('page.perps.pro.positions.marginContextChanged'), 'error');
        return;
      }
      const command = buildPerpsUpdateIsolatedMarginCommand({
        account,
        coin: activeEditor.coin,
        dexId: market.dexId || '',
        expectedSignedSize: signedSize.toFixed(),
        targetMargin: draft,
      });
      const result = await executePerpsUpdateIsolatedMargin(
        command,
        undefined,
        () => editorRef.current === activeEditor,
      );
      if (result.kind === 'success' || result.kind === 'noChange') {
        if (result.refreshError) {
          Sentry.captureException(new Error(result.refreshError), {
            extra: { scene: 'Perps Pro manage margin refresh' },
          });
        }
        resetEditor();
        showToast(t('page.perps.pro.positions.marginUpdated'), 'success');
        return;
      }
      if (result.kind === 'unknownOutcome') {
        resetEditor();
        showToast(t('page.perps.pro.positions.marginUpdateUnknown'), 'error');
        return;
      }
      if (result.failureReason === 'userCancelled') {
        return;
      }
      if (result.failureReason === 'regionRestricted') {
        showToast(t('page.perps.regionNotSupport'), 'error');
        return;
      }
      if (result.kind === 'staleContext') {
        resetEditor();
        showToast(t('page.perps.pro.positions.marginContextChanged'), 'error');
        return;
      }
      const error = result.error || 'Margin update failed';
      if (result.failureReason === 'insufficientMargin') {
        await refreshManageMarginFacts({
          accountAddress: account.address,
          dexId: command.dexId,
          userAbstraction: perpsStore.getState().userAbstraction,
        });
        showToast(
          t('page.perps.pro.positions.marginUpdateFailed', { reason: error }),
          'error',
        );
        return;
      }
      if (
        (await judgeIsUserAgentIsExpired(error)) ||
        judgeIsBuilderFeeNeedApprove(error)
      ) {
        return;
      }
      showToast(
        t('page.perps.pro.positions.marginUpdateFailed', { reason: error }),
        'error',
      );
    } catch (error) {
      if (isPerpsActionUserCancelled(error)) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      if (
        (await judgeIsUserAgentIsExpired(message)) ||
        judgeIsBuilderFeeNeedApprove(message)
      ) {
        return;
      }
      showToast(
        t('page.perps.pro.positions.marginUpdateFailed', { reason: message }),
        'error',
      );
      Sentry.captureException(
        error instanceof Error ? error : new Error(message),
        { extra: { scene: 'Perps Pro manage margin' } },
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, [dirty, draft, resetEditor, t, targetState]);

  return {
    beginEditing,
    changeDraft,
    close,
    confirm,
    dirty,
    draft,
    editor,
    open,
    pending,
    selectTarget,
    view,
  };
};
