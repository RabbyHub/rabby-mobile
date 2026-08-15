import type { Account } from '@/core/startupServices/preference';
import { ensurePerpsActionApproval } from '@/hooks/perps/actions/perpsActionApproval';
import { isPerpsActionUserCancelled } from '@/hooks/perps/actions/actionError';
import {
  buildPerpsUpdateIsolatedMarginCommand,
  executePerpsUpdateIsolatedMargin,
} from '@/hooks/perps/actions/updateIsolatedMargin';
import {
  getDexByCoin,
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
import {
  calculateLiquidationDistance,
  type PerpsPositionViewModel,
} from '../model/position';
import {
  buildPositionMarginRange,
  buildPositionMarginRiskProjection,
  formatPositionMarginTarget,
  resolvePositionMarginAvailable,
  validatePositionMarginTarget,
  type PositionMarginRange,
  type PositionMarginTargetState,
} from '../model/positionMargin';

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
  spotAvailable: null,
  userAbstraction: 'default',
  userAbstractionReady: false,
});

const selectManageMarginFacts = (state: PerpsState, coin: string) =>
  !coin
    ? EMPTY_FACTS
    : {
        account: state.currentPerpsAccount,
        clearinghouseState: state.currentClearinghouseState,
        hasPermission: state.hasPermission,
        isSpotStateReady: state.isSpotStateReady,
        isUserDataReady: state.isUserDataReady,
        market: state.marketDataMap[coin],
        spotAvailable: state.spotState.tokenToAvailableAfterMaintenance,
        userAbstraction: state.userAbstraction,
        userAbstractionReady: state.userAbstractionReady,
      };

const readLivePosition = (state: PerpsState, coin: string) =>
  state.currentClearinghouseState?.assetPositions.find(
    item => item.position.coin === coin,
  )?.position ?? null;

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

  const range = useMemo(() => {
    const market = facts.market;
    if (!market || !livePosition) {
      return null;
    }
    const available = resolvePositionMarginAvailable({
      accountFactsReady: facts.isUserDataReady,
      dexWithdrawable:
        facts.clearinghouseState?.perDexSummaries[market.dexId || '']
          ?.withdrawable,
      isSpotStateReady: facts.isSpotStateReady,
      quoteAsset: market.quoteAsset,
      tokenToAvailableAfterMaintenance: facts.spotAvailable,
      userAbstraction: facts.userAbstraction,
      userAbstractionReady: facts.userAbstractionReady,
    });
    return buildPositionMarginRange({
      available,
      currentMargin: livePosition.marginUsed,
      leverage: livePosition.leverage?.value,
      marginModeConstraint:
        market.marginMode ?? (market.onlyIsolated ? 'noCross' : null),
      markPrice: market.markPx,
      positionSize: livePosition.szi,
    });
  }, [facts, livePosition]);
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
    const projection = buildPositionMarginRiskProjection({
      direction,
      margin: draft,
      markPrice: market.markPx,
      positionSize: signedSize.abs().toFixed(),
      tiers: market.maintenanceMarginTiers,
    });
    const currentLiquidationDistance = calculateLiquidationDistance({
      direction,
      liquidationPrice: position.liquidationPx || null,
      markPrice: market.markPx || null,
    });
    return {
      currentLiquidationDistance,
      currentLiquidationPrice: position.liquidationPx || null,
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
      await ensurePerpsActionApproval(openingAccount as Account);
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
      const available = resolvePositionMarginAvailable({
        accountFactsReady: state.isUserDataReady,
        dexWithdrawable:
          state.currentClearinghouseState?.perDexSummaries[market.dexId || '']
            ?.withdrawable,
        isSpotStateReady: state.isSpotStateReady,
        quoteAsset: market.quoteAsset,
        tokenToAvailableAfterMaintenance:
          state.spotState.tokenToAvailableAfterMaintenance,
        userAbstraction: state.userAbstraction,
        userAbstractionReady: state.userAbstractionReady,
      });
      const latestRange = buildPositionMarginRange({
        available,
        currentMargin: position.marginUsed,
        leverage: position.leverage?.value,
        marginModeConstraint:
          market.marginMode ?? (market.onlyIsolated ? 'noCross' : null),
        markPrice: market.markPx,
        positionSize: signedSize.abs().toFixed(),
      });
      const latestTargetState = validatePositionMarginTarget({
        range: latestRange,
        target: draft,
      });
      if (latestTargetState === 'noChange') {
        resetEditor();
        showToast(t('page.perps.pro.positions.marginUpdated'), 'success');
        return;
      }
      if (latestTargetState !== 'valid') {
        return;
      }
      const command = buildPerpsUpdateIsolatedMarginCommand({
        account,
        coin: activeEditor.coin,
        dexId: getDexByCoin(activeEditor.coin),
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
