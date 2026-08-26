import type { Account } from '@/core/startupServices/preference';
import { perpsServiceApi } from '@/core/serviceApi/perps';
import { isSamePerpsActionAccount } from '@/hooks/perps/actions/accountGuard';
import { isPerpsActionUserCancelled } from '@/hooks/perps/actions/actionError';
import {
  buildPerpsCancelOrdersCommand,
  executePerpsCancelOrders,
} from '@/hooks/perps/actions/cancelOrders';
import { ensurePerpsActionApproval } from '@/hooks/perps/actions/perpsActionApproval';
import {
  buildPerpsPositionTpSlCommand,
  executePerpsPositionTpSl,
  type PerpsPositionTpSlCommand,
} from '@/hooks/perps/actions/positionTpSl';
import {
  judgeIsBuilderFeeNeedApprove,
  judgeIsUserAgentIsExpired,
} from '@/hooks/perps/perpsActionError';
import { showToast } from '@/hooks/perps/showToast';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import * as Sentry from '@sentry/react-native';
import BigNumber from 'bignumber.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { buildPerpsProMarketDescriptor } from '../model/market';
import type { PerpsPositionViewModel } from '../model/position';
import type {
  PerpsPositionTpSlDraft,
  PerpsPositionTpSlMarketSnapshot,
  PerpsPositionTpSlOrderViewModel,
} from '../model/positionTpSl';
import type { PerpsProTradeAmountUnit } from '../model/trade';

export interface PerpsProPositionTpSlEditorState {
  account: Account;
  amountUnit: PerpsProTradeAmountUnit;
  defaultTab: 'partial' | 'position';
  market: PerpsPositionTpSlMarketSnapshot;
  position: PerpsPositionViewModel;
}

export interface PerpsProPositionTpSlReviewState {
  command: PerpsPositionTpSlCommand;
  draft: PerpsPositionTpSlDraft;
  markPrice: string;
}

export interface PerpsProPositionTpSlSettlement {
  revision: number;
  scope: 'partial' | 'position';
}

const getLivePosition = (coin: string) => {
  const position = perpsStore
    .getState()
    .currentClearinghouseState?.assetPositions.find(
      item => item.position.coin === coin,
    )?.position;
  if (!position) {
    return null;
  }
  const signedSize = new BigNumber(position.szi || Number.NaN);
  if (!signedSize.isFinite() || signedSize.isZero()) {
    return null;
  }
  return {
    direction: signedSize.gt(0) ? ('long' as const) : ('short' as const),
    size: signedSize.abs().toString(),
  };
};

export const usePerpsProPositionTpSl = (
  accountIdentity: string,
  tradeAmountUnit: PerpsProTradeAmountUnit,
) => {
  const { t } = useTranslation();
  const editorSessionRef = useRef(0);
  const pendingRef = useRef(false);
  const reviewRequestRef = useRef(false);
  const settlementRevisionRef = useRef(0);
  const [editor, setEditor] = useState<PerpsProPositionTpSlEditorState | null>(
    null,
  );
  const [review, setReview] = useState<PerpsProPositionTpSlReviewState | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const [reviewRequesting, setReviewRequesting] = useState(false);
  const [submissionPending, setSubmissionPending] = useState(false);
  const [skipConfirmation, setSkipConfirmation] = useState(false);
  const [cancelingOids, setCancelingOids] = useState<number[]>([]);
  const [confirmedCancelledOids, setConfirmedCancelledOids] = useState<
    number[]
  >([]);
  const [settlement, setSettlement] =
    useState<PerpsProPositionTpSlSettlement | null>(null);

  useEffect(() => {
    editorSessionRef.current += 1;
    setEditor(null);
    setReview(null);
    setPending(false);
    setReviewRequesting(false);
    setSubmissionPending(false);
    setSkipConfirmation(false);
    setCancelingOids([]);
    setConfirmedCancelledOids([]);
    setSettlement(null);
    pendingRef.current = false;
    reviewRequestRef.current = false;
    return () => {
      editorSessionRef.current += 1;
      reviewRequestRef.current = false;
    };
  }, [accountIdentity]);

  const open = useCallback(
    (position: PerpsPositionViewModel, defaultTab: 'partial' | 'position') => {
      if (pendingRef.current) {
        return;
      }
      const state = perpsStore.getState();
      const account = state.currentPerpsAccount;
      const marketData = state.marketDataMap[position.coin];
      if (!account || !marketData?.markPx) {
        showToast(t('page.perps.pro.positionTpsl.unavailable'), 'error');
        return;
      }
      const descriptor = buildPerpsProMarketDescriptor(marketData);
      editorSessionRef.current += 1;
      setCancelingOids([]);
      setConfirmedCancelledOids([]);
      setSettlement(null);
      setSkipConfirmation(false);
      setEditor({
        account: { ...account },
        amountUnit: tradeAmountUnit,
        defaultTab,
        market: {
          displayBase: descriptor.displayBase,
          displayPair: descriptor.displayPair,
          markPrice: marketData.markPx,
          pxDecimals: marketData.pxDecimals,
          quoteAsset: marketData.quoteAsset,
          sourceTag: descriptor.sourceTag,
          szDecimals: marketData.szDecimals,
        },
        position: { ...position },
      });
      setReview(null);
    },
    [t, tradeAmountUnit],
  );

  const close = useCallback(() => {
    if (!pendingRef.current && !reviewRequestRef.current && !review) {
      editorSessionRef.current += 1;
      setEditor(null);
      setCancelingOids([]);
      setConfirmedCancelledOids([]);
      setSettlement(null);
    }
  }, [review]);
  const closeReview = useCallback(() => {
    if (!pendingRef.current) {
      setReview(null);
      setSkipConfirmation(false);
    }
  }, []);

  const settleSubmission = useCallback(
    (scope: PerpsProPositionTpSlSettlement['scope']) => {
      setReview(null);
      setSkipConfirmation(false);
      if (scope === 'position') {
        editorSessionRef.current += 1;
        reviewRequestRef.current = false;
        setReviewRequesting(false);
        setEditor(null);
        setCancelingOids([]);
        setConfirmedCancelledOids([]);
        setSettlement(null);
        return;
      }
      setSettlement({
        revision: ++settlementRevisionRef.current,
        scope,
      });
    },
    [],
  );

  const executeSubmission = useCallback(
    async (
      editorSnapshot: PerpsProPositionTpSlEditorState,
      command: PerpsPositionTpSlCommand,
    ) => {
      if (pendingRef.current) {
        return;
      }
      pendingRef.current = true;
      setPending(true);
      setSubmissionPending(true);
      try {
        await ensurePerpsActionApproval(editorSnapshot.account);
        const result = await executePerpsPositionTpSl(command);
        const hasMutation = result.legs.some(
          leg => leg.cancel === 'success' || leg.create === 'success',
        );
        if (result.failureReason === 'userCancelled' && !hasMutation) {
          return;
        }
        if (result.kind === 'staleContext') {
          showToast(t('page.perps.pro.positionTpsl.contextChanged'), 'error');
          setEditor(null);
          setReview(null);
          return;
        }
        if (result.refreshError) {
          Sentry.captureException(
            new Error(`Position TP/SL refresh failed: ${result.refreshError}`),
          );
        }
        if (result.kind === 'success') {
          showToast(t('page.perps.pro.positionTpsl.submitted'), 'success');
          settleSubmission(command.scope);
          return;
        }
        const replacedButNotCreated = result.legs.some(
          leg => leg.cancel === 'success' && leg.create !== 'success',
        );
        showToast(
          t(
            replacedButNotCreated
              ? 'page.perps.pro.positionTpsl.replaceFailedAfterCancel'
              : result.kind === 'partial'
              ? 'page.perps.pro.positionTpsl.partialSubmitted'
              : 'page.perps.pro.positionTpsl.submitFailed',
          ),
          'error',
        );
        if (hasMutation) {
          settleSubmission(command.scope);
        }
        const message = result.legs.find(leg => leg.error)?.error || '';
        if (
          (message && (await judgeIsUserAgentIsExpired(message))) ||
          judgeIsBuilderFeeNeedApprove(message)
        ) {
          return;
        }
        Sentry.captureException(
          new Error(`Position TP/SL submit failed: ${JSON.stringify(result)}`),
        );
        if (!hasMutation) {
          setReview(null);
        }
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
        showToast(t('page.perps.pro.positionTpsl.submitFailed'), 'error');
        Sentry.captureException(
          error instanceof Error ? error : new Error(message),
          { extra: { scene: 'Perps Pro position TP/SL' } },
        );
      } finally {
        pendingRef.current = false;
        setPending(false);
        setSubmissionPending(false);
      }
    },
    [settleSubmission, t],
  );

  const requestReview = useCallback(
    async (draft: PerpsPositionTpSlDraft) => {
      if (!editor || pendingRef.current || reviewRequestRef.current) {
        return;
      }
      const state = perpsStore.getState();
      const account = state.currentPerpsAccount;
      const market = state.marketDataMap[editor.position.coin];
      const livePosition = getLivePosition(editor.position.coin);
      if (
        !isSamePerpsActionAccount(account, editor.account) ||
        !market?.markPx ||
        !livePosition ||
        livePosition.direction !== editor.position.direction
      ) {
        showToast(t('page.perps.pro.positionTpsl.contextChanged'), 'error');
        setEditor(null);
        return;
      }
      const editorSession = editorSessionRef.current;
      reviewRequestRef.current = true;
      setReviewRequesting(true);
      try {
        const command = buildPerpsPositionTpSlCommand({
          account: editor.account,
          coin: editor.position.coin,
          direction: livePosition.direction,
          expectedPositionSize: livePosition.size,
          legs: draft.legs,
          markPrice: market.markPx,
          pxDecimals: market.pxDecimals,
          scope: draft.scope,
          szDecimals: market.szDecimals,
        });
        let skip = false;
        try {
          skip =
            await perpsServiceApi.getSkipPerpsProPositionTpSlConfirmation();
        } catch (error) {
          Sentry.captureException(error, {
            extra: { scene: 'Perps Pro position TP/SL preference read' },
          });
        }
        if (
          editorSessionRef.current !== editorSession ||
          pendingRef.current ||
          !isSamePerpsActionAccount(
            perpsStore.getState().currentPerpsAccount,
            editor.account,
          )
        ) {
          return;
        }
        setSkipConfirmation(skip);
        if (skip) {
          await executeSubmission(editor, command);
        } else {
          setReview({ command, draft, markPrice: market.markPx });
        }
      } catch (error) {
        showToast(t('page.perps.pro.positionTpsl.invalidOrder'), 'error');
      } finally {
        if (editorSessionRef.current === editorSession) {
          reviewRequestRef.current = false;
          setReviewRequesting(false);
        }
      }
    },
    [editor, executeSubmission, t],
  );

  const confirm = useCallback(async () => {
    if (!editor || !review || pendingRef.current) {
      return;
    }
    if (skipConfirmation) {
      perpsServiceApi
        .setSkipPerpsProPositionTpSlConfirmation(true)
        .catch(error => {
          Sentry.captureException(error, {
            extra: { scene: 'Perps Pro position TP/SL preference write' },
          });
        });
    }
    await executeSubmission(editor, review.command);
  }, [editor, executeSubmission, review, skipConfirmation]);

  const toggleSkipConfirmation = useCallback(() => {
    if (!pendingRef.current) {
      setSkipConfirmation(current => !current);
    }
  }, []);

  const cancelOrder = useCallback(
    async (order: PerpsPositionTpSlOrderViewModel) => {
      if (!editor || pendingRef.current || cancelingOids.includes(order.oid)) {
        return;
      }
      const state = perpsStore.getState();
      if (
        !isSamePerpsActionAccount(state.currentPerpsAccount, editor.account)
      ) {
        showToast(t('page.perps.pro.positionTpsl.contextChanged'), 'error');
        setEditor(null);
        return;
      }
      const liveOrder = state.openOrders.find(
        item => item.oid === order.oid && item.coin === editor.position.coin,
      );
      if (!liveOrder?.reduceOnly || !liveOrder.isTrigger) {
        showToast(t('page.perps.pro.positionTpsl.contextChanged'), 'error');
        return;
      }

      pendingRef.current = true;
      setPending(true);
      setCancelingOids(current => [...current, order.oid]);
      const editorSession = editorSessionRef.current;
      let waitsForToast = false;
      try {
        const command = buildPerpsCancelOrdersCommand(editor.account, [
          { coin: editor.position.coin, oid: order.oid },
        ]);
        await ensurePerpsActionApproval(editor.account);
        const result = await executePerpsCancelOrders(command);
        if (result.failureReason === 'userCancelled') {
          return;
        }
        if (result.kind === 'staleContext') {
          showToast(t('page.perps.pro.positionTpsl.contextChanged'), 'error');
          setEditor(null);
          return;
        }
        if (result.kind === 'success') {
          if (result.refreshError) {
            Sentry.captureException(
              new Error(
                `Position TP/SL order refresh failed: ${result.refreshError}`,
              ),
            );
          }
          waitsForToast = true;
          showToast(t('page.perps.pro.positionTpsl.cancelSuccess'), 'success', {
            onHidden: () => {
              if (editorSessionRef.current !== editorSession) {
                return;
              }
              setConfirmedCancelledOids(current =>
                current.includes(order.oid) ? current : [...current, order.oid],
              );
              setCancelingOids(current =>
                current.filter(oid => oid !== order.oid),
              );
            },
          });
          return;
        }
        const message = result.items[0]?.error || '';
        if (
          (message && (await judgeIsUserAgentIsExpired(message))) ||
          judgeIsBuilderFeeNeedApprove(message)
        ) {
          return;
        }
        showToast(t('page.perps.pro.positionTpsl.cancelFailed'), 'error');
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
        showToast(t('page.perps.pro.positionTpsl.cancelFailed'), 'error');
        Sentry.captureException(
          error instanceof Error ? error : new Error(message),
          { extra: { scene: 'Perps Pro cancel position TP/SL' } },
        );
      } finally {
        pendingRef.current = false;
        setPending(false);
        if (!waitsForToast) {
          setCancelingOids(current => current.filter(oid => oid !== order.oid));
        }
      }
    },
    [cancelingOids, editor, t],
  );

  return {
    cancelOrder,
    cancelingOids,
    confirmedCancelledOids,
    close,
    closeReview,
    confirm,
    editor,
    open,
    pending,
    reviewRequesting,
    requestReview,
    review,
    settlement,
    skipConfirmation,
    submissionPending,
    toggleSkipConfirmation,
  };
};
