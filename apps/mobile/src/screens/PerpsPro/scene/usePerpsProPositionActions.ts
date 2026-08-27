import type { Account } from '@/core/startupServices/preference';
import { perpsServiceApi } from '@/core/serviceApi/perps';
import { isPerpsActionUserCancelled } from '@/hooks/perps/actions/actionError';
import {
  buildPerpsClosePositionCommand,
  executePerpsClosePosition,
  isPerpsCloseMinimumNotionalError,
  validatePerpsCloseAmount,
} from '@/hooks/perps/actions/closePosition';
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
import { reportPerpsProClosePositionHistory } from '../analytics/manualTradeHistory';
import {
  buildPerpsProMarketDescriptor,
  buildPerpsProMarketKey,
} from '../model/market';
import type {
  PerpsProCloseDraft,
  PerpsProCloseMarketSnapshot,
} from '../model/positionAction';
import type { PerpsProLeverageUpdateRequest } from './usePerpsProLeverageUpdate';

interface LeverageEditorState {
  account: Account;
  marketKey: string;
  position: PerpsPositionViewModel;
}

export interface PerpsProCloseEditorState {
  account: Account;
  market: PerpsProCloseMarketSnapshot;
  position: PerpsPositionViewModel;
}

export const usePerpsProPositionActions = ({
  accountIdentity,
  leveragePending,
  updateLeverageRequest,
}: {
  accountIdentity: string;
  leveragePending: boolean;
  updateLeverageRequest: (
    request: PerpsProLeverageUpdateRequest,
  ) => Promise<boolean>;
}) => {
  const { t } = useTranslation();
  const pendingRef = useRef(false);
  const [leverageEditor, setLeverageEditor] =
    useState<LeverageEditorState | null>(null);
  const [closeEditor, setCloseEditor] =
    useState<PerpsProCloseEditorState | null>(null);
  const [closeReview, setCloseReview] = useState<PerpsProCloseDraft | null>(
    null,
  );
  const [closePending, setClosePending] = useState(false);
  const [skipLimitConfirmation, setSkipLimitConfirmation] = useState(false);
  const [skipMarketConfirmation, setSkipMarketConfirmation] = useState(false);
  const showMinimumCloseAmountToast = useCallback(() => {
    showToast(t('page.perps.pro.positions.minimumCloseAmount'), 'error');
  }, [t]);

  useEffect(() => {
    setLeverageEditor(null);
    setCloseEditor(null);
    setCloseReview(null);
    setClosePending(false);
    setSkipLimitConfirmation(false);
    setSkipMarketConfirmation(false);
  }, [accountIdentity]);

  const openLeverageEditor = useCallback(
    (position: PerpsPositionViewModel) => {
      if (pendingRef.current || leveragePending) {
        return;
      }
      const account = perpsStore.getState().currentPerpsAccount;
      const marketData = perpsStore.getState().marketDataMap[position.coin];
      if (!account) {
        showToast(
          t('page.perps.pro.positions.leverageUpdateFailed', {
            reason: t('page.perps.pro.common.unavailable'),
          }),
          'error',
        );
        return;
      }
      setLeverageEditor({
        account: { ...account },
        marketKey: marketData
          ? buildPerpsProMarketDescriptor(marketData).marketKey
          : buildPerpsProMarketKey('', position.coin),
        position: { ...position },
      });
    },
    [leveragePending, t],
  );
  const closeLeverageEditor = useCallback(() => {
    if (!pendingRef.current && !leveragePending) {
      setLeverageEditor(null);
    }
  }, [leveragePending]);

  const updateLeverage = useCallback(
    async (leverage: number) => {
      if (!leverageEditor || leveragePending) return;
      const success = await updateLeverageRequest({
        account: leverageEditor.account,
        coin: leverageEditor.position.coin,
        currentIsCross: leverageEditor.position.marginMode === 'cross',
        currentLeverage: leverageEditor.position.leverage,
        isCross: leverageEditor.position.marginMode === 'cross',
        leverage,
        maxLeverage: leverageEditor.position.maxLeverage,
      });
      if (success) {
        setLeverageEditor(null);
      }
    },
    [leverageEditor, leveragePending, updateLeverageRequest],
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
      const midPrice = marketData.midPx;
      if (!markPrice || !midPrice) {
        showToast(t('page.perps.pro.positions.closeFailed'), 'error');
        return;
      }
      const descriptor = buildPerpsProMarketDescriptor(marketData);
      const snapshot: PerpsProCloseEditorState = {
        account: { ...account },
        market: {
          displayBase: descriptor.displayBase,
          displayPair: descriptor.displayPair,
          markPrice,
          midPrice,
          pxDecimals: marketData.pxDecimals,
          quoteAsset: marketData.quoteAsset,
          sourceTag: descriptor.sourceTag,
          szDecimals: marketData.szDecimals,
        },
        position: { ...position },
      };
      setCloseEditor(snapshot);
      setCloseReview(null);
      setSkipLimitConfirmation(false);
      setSkipMarketConfirmation(false);
      void Promise.all([
        perpsServiceApi.getSkipPerpsProLimitCloseConfirmation().catch(error => {
          Sentry.captureException(error, {
            extra: { scene: 'Perps Pro Limit close preference read' },
          });
          return false;
        }),
        perpsServiceApi
          .getSkipPerpsProMarketCloseConfirmation()
          .catch(error => {
            Sentry.captureException(error, {
              extra: { scene: 'Perps Pro Market close preference read' },
            });
            return false;
          }),
      ]).then(([skipLimit, skipMarket]) => {
        const live = perpsStore.getState().currentPerpsAccount;
        if (
          live?.address.toLowerCase() === account.address.toLowerCase() &&
          live.type === account.type
        ) {
          setSkipLimitConfirmation(skipLimit);
          setSkipMarketConfirmation(skipMarket);
        }
      });
    },
    [t],
  );

  const closeCloseEditor = useCallback(() => {
    if (!pendingRef.current && !closeReview) {
      setCloseEditor(null);
      setCloseReview(null);
    }
  }, [closeReview]);
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
          midPrice: draft.midPrice,
          orderType: draft.orderType,
          pxDecimals: closeEditor.market.pxDecimals,
          reportingFacts: {
            leverage: closeEditor.position.leverage,
            marginMode: closeEditor.position.marginMode,
          },
          size: draft.size,
          szDecimals: closeEditor.market.szDecimals,
        });
        await ensurePerpsActionApproval(closeEditor.account);
        const result = await executePerpsClosePosition(command);
        reportPerpsProClosePositionHistory(command, result.confirmed);
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
          if (result.failureReason === 'minimumNotional') {
            showMinimumCloseAmountToast();
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
        if (isPerpsCloseMinimumNotionalError(message)) {
          showMinimumCloseAmountToast();
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
    [closeEditor, showMinimumCloseAmountToast, t],
  );

  const freezeCloseDraft = useCallback(
    (draft: PerpsProCloseDraft): PerpsProCloseDraft | null => {
      if (!closeEditor) return null;
      const marketData =
        perpsStore.getState().marketDataMap[closeEditor.position.coin];
      const markPrice = marketData?.markPx;
      const midPrice = marketData?.midPx;
      if (!midPrice || !markPrice) {
        showToast(t('page.perps.pro.positions.closeFailed'), 'error');
        return null;
      }
      const amountValidation = validatePerpsCloseAmount({
        expectedPositionSize: closeEditor.position.baseSize,
        referencePrice:
          draft.orderType === 'market'
            ? midPrice
            : draft.limitPrice || draft.referencePrice,
        size: draft.size,
      });
      if (amountValidation.kind === 'invalid') {
        if (amountValidation.reason === 'belowMinimumNotional') {
          showMinimumCloseAmountToast();
        } else {
          showToast(t('page.perps.pro.positions.closeFailed'), 'error');
        }
        return null;
      }
      return {
        ...draft,
        midPrice,
        referencePrice:
          draft.orderType === 'market' ? markPrice : draft.referencePrice,
      };
    },
    [closeEditor, showMinimumCloseAmountToast, t],
  );

  const reviewClose = useCallback(
    (draft: PerpsProCloseDraft) => {
      if (pendingRef.current || closeReview) {
        return;
      }
      const frozenDraft = freezeCloseDraft(draft);
      if (!frozenDraft) {
        return;
      }
      const skipConfirmation =
        frozenDraft.orderType === 'market'
          ? skipMarketConfirmation
          : skipLimitConfirmation;
      if (skipConfirmation) {
        void executeClose(frozenDraft);
        return;
      }
      setCloseReview(frozenDraft);
    },
    [
      closeReview,
      executeClose,
      freezeCloseDraft,
      skipLimitConfirmation,
      skipMarketConfirmation,
    ],
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
    if (closeReview.orderType === 'market' && skipMarketConfirmation) {
      void perpsServiceApi
        .setSkipPerpsProMarketCloseConfirmation(true)
        .catch(error => {
          Sentry.captureException(error, {
            extra: { scene: 'Perps Pro Market close preference write' },
          });
        });
    }
    void executeClose(closeReview);
  }, [
    closeReview,
    executeClose,
    skipLimitConfirmation,
    skipMarketConfirmation,
  ]);

  const skipCloseConfirmation =
    closeReview?.orderType === 'market'
      ? skipMarketConfirmation
      : skipLimitConfirmation;
  const toggleSkipCloseConfirmation = useCallback(() => {
    if (closeReview?.orderType === 'market') {
      setSkipMarketConfirmation(value => !value);
    } else if (closeReview?.orderType === 'limit') {
      setSkipLimitConfirmation(value => !value);
    }
  }, [closeReview?.orderType]);

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
    skipCloseConfirmation,
    toggleSkipCloseConfirmation,
    updateLeverage,
  };
};
