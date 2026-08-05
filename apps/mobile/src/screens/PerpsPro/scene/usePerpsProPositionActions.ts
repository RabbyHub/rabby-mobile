import type { Account } from '@/core/startupServices/preference';
import { perpsServiceApi } from '@/core/serviceApi/perps';
import { isPerpsActionUserCancelled } from '@/hooks/perps/actions/actionError';
import {
  buildPerpsClosePositionCommand,
  executePerpsClosePosition,
} from '@/hooks/perps/actions/closePosition';
import {
  buildPerpsUpdateLeverageCommand,
  executePerpsUpdateLeverage,
} from '@/hooks/perps/actions/updateLeverage';
import { ensurePerpsActionApproval } from '@/hooks/perps/actions/perpsActionApproval';
import {
  judgeIsBuilderFeeNeedApprove,
  judgeIsUserAgentIsExpired,
} from '@/hooks/perps/perpsActionError';
import { showToast } from '@/hooks/perps/showToast';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import * as Sentry from '@sentry/react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { PerpsPositionViewModel } from '../model/position';
import type {
  PerpsProCloseDraft,
  PerpsProCloseMarketSnapshot,
} from '../model/positionAction';

interface LeverageEditorState {
  account: Account;
  position: PerpsPositionViewModel;
}

export interface PerpsProCloseEditorState {
  account: Account;
  market: PerpsProCloseMarketSnapshot;
  position: PerpsPositionViewModel;
}

export const usePerpsProPositionActions = ({
  accountIdentity,
  refreshActiveAssetData,
}: {
  accountIdentity: string;
  refreshActiveAssetData: () => Promise<unknown>;
}) => {
  const { t } = useTranslation();
  const pendingRef = useRef(false);
  const [leverageEditor, setLeverageEditor] =
    useState<LeverageEditorState | null>(null);
  const [leveragePending, setLeveragePending] = useState(false);
  const [closeEditor, setCloseEditor] =
    useState<PerpsProCloseEditorState | null>(null);
  const [closeReview, setCloseReview] = useState<PerpsProCloseDraft | null>(
    null,
  );
  const [closePending, setClosePending] = useState(false);
  const [skipLimitConfirmation, setSkipLimitConfirmation] = useState(false);
  const transitioningToReviewRef = useRef(false);

  useEffect(() => {
    setLeverageEditor(null);
    setLeveragePending(false);
    setCloseEditor(null);
    setCloseReview(null);
    setClosePending(false);
    transitioningToReviewRef.current = false;
  }, [accountIdentity]);

  const openLeverageEditor = useCallback(
    (position: PerpsPositionViewModel) => {
      if (pendingRef.current) {
        return;
      }
      const account = perpsStore.getState().currentPerpsAccount;
      if (!account) {
        showToast(t('page.perps.pro.positions.leverageUpdateFailed'), 'error');
        return;
      }
      setLeverageEditor({
        account: { ...account },
        position: { ...position },
      });
    },
    [t],
  );
  const closeLeverageEditor = useCallback(() => {
    if (!pendingRef.current) {
      setLeverageEditor(null);
    }
  }, []);

  const updateLeverage = useCallback(
    async (leverage: number) => {
      if (!leverageEditor || pendingRef.current) {
        return;
      }
      pendingRef.current = true;
      setLeveragePending(true);
      try {
        const command = buildPerpsUpdateLeverageCommand({
          account: leverageEditor.account,
          coin: leverageEditor.position.coin,
          isCross: leverageEditor.position.marginMode === 'cross',
          leverage,
          maxLeverage: leverageEditor.position.maxLeverage,
        });
        await ensurePerpsActionApproval(leverageEditor.account);
        const result = await executePerpsUpdateLeverage(command);
        if (result.failureReason === 'userCancelled') {
          return;
        }
        if (result.kind === 'staleContext') {
          showToast(
            t('page.perps.pro.openOrders.cancelContextChanged'),
            'error',
          );
          setLeverageEditor(null);
          return;
        }
        if (result.kind !== 'success') {
          if (
            (result.error && (await judgeIsUserAgentIsExpired(result.error))) ||
            judgeIsBuilderFeeNeedApprove(result.error || '')
          ) {
            return;
          }
          showToast(
            t('page.perps.pro.positions.leverageUpdateFailed'),
            'error',
          );
          Sentry.captureException(
            new Error(`Perps Pro leverage update failed: ${result.error}`),
          );
          return;
        }
        if (result.refreshError) {
          Sentry.captureException(
            new Error(
              `Perps Pro leverage refresh failed: ${result.refreshError}`,
            ),
          );
        }
        await refreshActiveAssetData().catch(error => {
          Sentry.captureException(error, {
            extra: { scene: 'Perps Pro active asset leverage refresh' },
          });
        });
        showToast(t('page.perps.pro.positions.leverageUpdated'), 'success');
        setLeverageEditor(null);
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
        showToast(t('page.perps.pro.positions.leverageUpdateFailed'), 'error');
        Sentry.captureException(
          error instanceof Error ? error : new Error(message),
          { extra: { scene: 'Perps Pro leverage update' } },
        );
      } finally {
        pendingRef.current = false;
        setLeveragePending(false);
      }
    },
    [leverageEditor, refreshActiveAssetData, t],
  );

  const openCloseEditor = useCallback(
    (position: PerpsPositionViewModel) => {
      if (pendingRef.current) {
        return;
      }
      const state = perpsStore.getState();
      const account = state.currentPerpsAccount;
      const marketData = state.marketDataMap[position.coin];
      if (!account || !marketData) {
        showToast(t('page.perps.pro.positions.closeFailed'), 'error');
        return;
      }
      const markPrice = marketData.markPx;
      const midPrice = marketData.midPx || markPrice;
      if (!markPrice || !midPrice) {
        showToast(t('page.perps.pro.positions.closeFailed'), 'error');
        return;
      }
      const displayBase =
        (marketData.displayName || marketData.name).split(':').pop() ||
        marketData.name;
      const snapshot: PerpsProCloseEditorState = {
        account: { ...account },
        market: {
          displayBase,
          displayPair: `${displayBase}${marketData.quoteAsset}`,
          markPrice,
          midPrice,
          pxDecimals: marketData.pxDecimals,
          quoteAsset: marketData.quoteAsset,
          szDecimals: marketData.szDecimals,
        },
        position: { ...position },
      };
      setCloseEditor(snapshot);
      setCloseReview(null);
      setSkipLimitConfirmation(false);
      void perpsServiceApi
        .getSkipPerpsProLimitCloseConfirmation()
        .then(value => {
          const live = perpsStore.getState().currentPerpsAccount;
          if (
            live?.address.toLowerCase() === account.address.toLowerCase() &&
            live.type === account.type
          ) {
            setSkipLimitConfirmation(value);
          }
        })
        .catch(error => {
          Sentry.captureException(error, {
            extra: { scene: 'Perps Pro close preference read' },
          });
        });
    },
    [t],
  );

  const closeCloseEditor = useCallback(() => {
    if (transitioningToReviewRef.current) {
      transitioningToReviewRef.current = false;
      return;
    }
    if (!pendingRef.current) {
      setCloseEditor(null);
      setCloseReview(null);
    }
  }, []);
  const cancelCloseReview = useCallback(() => {
    if (!pendingRef.current) setCloseReview(null);
  }, []);

  const executeClose = useCallback(
    async (draft: PerpsProCloseDraft) => {
      if (!closeEditor || pendingRef.current) return;
      pendingRef.current = true;
      setClosePending(true);
      try {
        const command = buildPerpsClosePositionCommand({
          account: closeEditor.account,
          coin: closeEditor.position.coin,
          direction: closeEditor.position.direction,
          expectedPositionSize: closeEditor.position.baseSize,
          limitPrice: draft.limitPrice,
          midPrice: closeEditor.market.midPrice,
          orderType: draft.orderType,
          size: draft.size,
          szDecimals: closeEditor.market.szDecimals,
        });
        await ensurePerpsActionApproval(closeEditor.account);
        const result = await executePerpsClosePosition(command);
        if (result.failureReason === 'userCancelled') return;
        if (result.kind === 'staleContext') {
          showToast(t('page.perps.pro.positions.closeContextChanged'), 'error');
          setCloseEditor(null);
          setCloseReview(null);
          return;
        }
        if (result.kind === 'failed') {
          if (
            (result.error && (await judgeIsUserAgentIsExpired(result.error))) ||
            judgeIsBuilderFeeNeedApprove(result.error || '')
          ) {
            return;
          }
          showToast(t('page.perps.pro.positions.closeFailed'), 'error');
          Sentry.captureException(
            new Error(`Perps Pro close failed: ${result.error}`),
          );
          return;
        }
        if (result.refreshError) {
          Sentry.captureException(
            new Error(`Perps Pro close refresh failed: ${result.refreshError}`),
          );
        }
        showToast(t('page.perps.pro.positions.closeSubmitted'), 'success');
        setCloseEditor(null);
        setCloseReview(null);
      } catch (error) {
        if (isPerpsActionUserCancelled(error)) return;
        const message = error instanceof Error ? error.message : String(error);
        if (
          (await judgeIsUserAgentIsExpired(message)) ||
          judgeIsBuilderFeeNeedApprove(message)
        ) {
          return;
        }
        showToast(t('page.perps.pro.positions.closeFailed'), 'error');
        Sentry.captureException(
          error instanceof Error ? error : new Error(message),
          { extra: { scene: 'Perps Pro close position' } },
        );
      } finally {
        pendingRef.current = false;
        setClosePending(false);
      }
    },
    [closeEditor, t],
  );

  const reviewClose = useCallback(
    (draft: PerpsProCloseDraft) => {
      if (draft.orderType === 'limit' && skipLimitConfirmation) {
        void executeClose(draft);
        return;
      }
      transitioningToReviewRef.current = true;
      setCloseReview({ ...draft });
    },
    [executeClose, skipLimitConfirmation],
  );

  const confirmClose = useCallback(() => {
    if (!closeReview) return;
    if (closeReview.orderType === 'limit' && skipLimitConfirmation) {
      void perpsServiceApi
        .setSkipPerpsProLimitCloseConfirmation(true)
        .catch(error => {
          Sentry.captureException(error, {
            extra: { scene: 'Perps Pro close preference write' },
          });
        });
    }
    void executeClose(closeReview);
  }, [closeReview, executeClose, skipLimitConfirmation]);

  return {
    cancelCloseReview,
    closeEditor,
    closePending,
    closeReview,
    closeCloseEditor,
    closeLeverageEditor,
    leverageEditor,
    leveragePending,
    openLeverageEditor,
    openCloseEditor,
    reviewClose,
    confirmClose,
    setSkipLimitConfirmation,
    skipLimitConfirmation,
    updateLeverage,
  };
};
