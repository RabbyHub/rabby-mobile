import type { Account } from '@/core/startupServices/preference';
import { perpsServiceApi } from '@/core/serviceApi/perps';
import { isSamePerpsActionAccount } from '@/hooks/perps/actions/accountGuard';
import { isPerpsActionUserCancelled } from '@/hooks/perps/actions/actionError';
import {
  buildPerpsModifyOpenOrderCommand,
  executePerpsModifyOpenOrder,
  type PerpsModifyOpenOrderCommand,
} from '@/hooks/perps/actions/modifyOpenOrder';
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
import type { PerpsOpenOrderViewModel } from '../model/openOrder';
import {
  isMatchingPartialTpSlPosition,
  resolveBasicOrderEditBaseSize,
  type PerpsProBasicOrderEditDraft,
  type PerpsProConditionalOrderEditDraft,
  type PerpsProOpenOrderEditMarketSnapshot,
} from '../model/openOrderEdit';
import type { PerpsPositionViewModel } from '../model/position';
import type { PerpsProTradeAmountUnit } from '../model/trade';

type CommonEditorState = {
  account: Account;
  amountUnit: PerpsProTradeAmountUnit;
  market: PerpsProOpenOrderEditMarketSnapshot;
  order: PerpsOpenOrderViewModel;
};

export type PerpsProOpenOrderEditEditorState =
  | (CommonEditorState & { category: 'basic' })
  | (CommonEditorState & {
      category: 'conditional';
      position: PerpsPositionViewModel;
    });

export type PerpsProOpenOrderEditReviewState =
  | {
      category: 'basic';
      command: PerpsModifyOpenOrderCommand;
    }
  | {
      category: 'conditional';
      command: PerpsPositionTpSlCommand;
      markPrice: string;
    };

const getLivePosition = (coin: string) => {
  const position = perpsStore
    .getState()
    .currentClearinghouseState?.assetPositions.find(
      item => item.position.coin === coin,
    )?.position;
  if (!position) return null;
  const signedSize = new BigNumber(position.szi || Number.NaN);
  if (!signedSize.isFinite() || signedSize.isZero()) return null;
  return {
    direction: signedSize.gt(0) ? ('long' as const) : ('short' as const),
    size: signedSize.abs().toString(),
  };
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error || '');

export const usePerpsProOpenOrderEdit = (
  accountIdentity: string,
  tradeAmountUnit: PerpsProTradeAmountUnit,
) => {
  const { t } = useTranslation();
  const sessionRef = useRef(0);
  const pendingRef = useRef(false);
  const reviewRequestRef = useRef(false);
  const [editor, setEditor] = useState<PerpsProOpenOrderEditEditorState | null>(
    null,
  );
  const [review, setReview] = useState<PerpsProOpenOrderEditReviewState | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const [skipConfirmation, setSkipConfirmation] = useState(false);

  useEffect(() => {
    sessionRef.current += 1;
    pendingRef.current = false;
    reviewRequestRef.current = false;
    setEditor(null);
    setReview(null);
    setPending(false);
    setSkipConfirmation(false);
    return () => {
      sessionRef.current += 1;
      reviewRequestRef.current = false;
    };
  }, [accountIdentity]);

  const open = useCallback(
    (
      order: PerpsOpenOrderViewModel,
      position?: PerpsPositionViewModel | null,
    ) => {
      if (pendingRef.current || !order.editKind) return;
      const state = perpsStore.getState();
      const account = state.currentPerpsAccount;
      const marketData = state.marketDataMap[order.coin];
      if (!account || !marketData) {
        showToast(t('page.perps.pro.openOrders.editUnavailable'), 'error');
        return;
      }
      const descriptor = buildPerpsProMarketDescriptor(marketData);
      const market: PerpsProOpenOrderEditMarketSnapshot = {
        dexId: marketData.dexId,
        displayBase: descriptor.displayBase,
        displayPair: descriptor.displayPair,
        markPrice: marketData.markPx || '',
        marketKey: descriptor.marketKey,
        pxDecimals: marketData.pxDecimals,
        quoteAsset: marketData.quoteAsset,
        sourceTag: descriptor.sourceTag,
        szDecimals: marketData.szDecimals,
      };
      let next: PerpsProOpenOrderEditEditorState | null = null;
      if (order.editKind === 'basicLimit' && order.executionPrice) {
        next = {
          account: { ...account },
          amountUnit: tradeAmountUnit,
          category: 'basic',
          market,
          order: { ...order },
        };
      } else if (
        order.editKind === 'partialTpSlMarket' &&
        market.markPrice &&
        isMatchingPartialTpSlPosition(order, position)
      ) {
        next = {
          account: { ...account },
          amountUnit: tradeAmountUnit,
          category: 'conditional',
          market,
          order: { ...order },
          position: { ...position! },
        };
      }
      if (!next) {
        showToast(t('page.perps.pro.openOrders.editUnavailable'), 'error');
        return;
      }
      sessionRef.current += 1;
      setSkipConfirmation(false);
      setReview(null);
      setEditor(next);
    },
    [t, tradeAmountUnit],
  );

  const close = useCallback(() => {
    if (!pendingRef.current && !review) {
      sessionRef.current += 1;
      setEditor(null);
      setSkipConfirmation(false);
    }
  }, [review]);

  const closeReview = useCallback(() => {
    if (!pendingRef.current) {
      setReview(null);
      setSkipConfirmation(false);
    }
  }, []);

  const finish = useCallback(() => {
    sessionRef.current += 1;
    setReview(null);
    setEditor(null);
    setSkipConfirmation(false);
  }, []);

  const handleKnownActionError = useCallback(async (message: string) => {
    if (
      (message && (await judgeIsUserAgentIsExpired(message))) ||
      judgeIsBuilderFeeNeedApprove(message)
    ) {
      return true;
    }
    return false;
  }, []);

  const execute = useCallback(
    async (
      editorSnapshot: PerpsProOpenOrderEditEditorState,
      reviewSnapshot: PerpsProOpenOrderEditReviewState,
    ) => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      setPending(true);
      try {
        await ensurePerpsActionApproval(editorSnapshot.account);
        if (reviewSnapshot.category === 'basic') {
          const result = await executePerpsModifyOpenOrder(
            reviewSnapshot.command,
          );
          if (result.failureReason === 'userCancelled') return;
          if (result.failureReason === 'regionRestricted') {
            showToast(t('page.perps.regionNotSupport'), 'error');
            setReview(null);
            return;
          }
          if (result.kind === 'staleContext') {
            showToast(
              t('page.perps.pro.openOrders.editContextChanged'),
              'error',
            );
            finish();
            return;
          }
          if (result.refreshError) {
            Sentry.captureException(
              new Error(
                `Open order edit refresh failed: ${result.refreshError}`,
              ),
            );
          }
          if (
            result.kind === 'filled' ||
            result.kind === 'resting' ||
            result.kind === 'updated'
          ) {
            showToast(t('page.perps.pro.openOrders.editSubmitted'), 'success');
            finish();
            return;
          }
          if (result.kind === 'unknownOutcome') {
            showToast(t('page.perps.pro.openOrders.editUnknown'), 'error');
            finish();
            return;
          }
          if (await handleKnownActionError(result.error || '')) return;
          showToast(
            result.error || t('page.perps.pro.openOrders.editFailed'),
            'error',
          );
          setReview(null);
          return;
        }

        const result = await executePerpsPositionTpSl(reviewSnapshot.command);
        const hasMutation = result.legs.some(
          leg => leg.cancel === 'success' || leg.create === 'success',
        );
        if (result.failureReason === 'userCancelled' && !hasMutation) return;
        if (result.kind === 'staleContext') {
          showToast(t('page.perps.pro.openOrders.editContextChanged'), 'error');
          finish();
          return;
        }
        if (result.refreshError) {
          Sentry.captureException(
            new Error(
              `Conditional open order edit refresh failed: ${result.refreshError}`,
            ),
          );
        }
        if (result.kind === 'success') {
          showToast(t('page.perps.pro.openOrders.editSubmitted'), 'success');
          finish();
          return;
        }
        const replacedButNotCreated = result.legs.some(
          leg => leg.cancel === 'success' && leg.create !== 'success',
        );
        const message = result.legs.find(leg => leg.error)?.error || '';
        if (await handleKnownActionError(message)) {
          if (hasMutation) finish();
          return;
        }
        showToast(
          hasMutation
            ? t(
                replacedButNotCreated
                  ? 'page.perps.pro.openOrders.editReplaceFailedAfterCancel'
                  : 'page.perps.pro.openOrders.editPartial',
              )
            : message || t('page.perps.pro.openOrders.editFailed'),
          'error',
        );
        if (hasMutation) finish();
        Sentry.captureException(
          new Error(
            `Conditional open order edit failed: ${JSON.stringify(result)}`,
          ),
        );
        if (!hasMutation) setReview(null);
      } catch (error) {
        if (isPerpsActionUserCancelled(error)) return;
        const message = getErrorMessage(error);
        if (await handleKnownActionError(message)) return;
        showToast(
          message || t('page.perps.pro.openOrders.editFailed'),
          'error',
        );
        Sentry.captureException(
          error instanceof Error ? error : new Error(message),
          { extra: { scene: 'Perps Pro open order edit' } },
        );
      } finally {
        pendingRef.current = false;
        setPending(false);
      }
    },
    [finish, handleKnownActionError, t],
  );

  const stageReview = useCallback(
    async (
      editorSnapshot: PerpsProOpenOrderEditEditorState,
      nextReview: PerpsProOpenOrderEditReviewState,
    ) => {
      const session = sessionRef.current;
      let skip = false;
      try {
        skip = await perpsServiceApi.getSkipPerpsProOpenOrderEditConfirmation(
          nextReview.category,
        );
      } catch (error) {
        Sentry.captureException(error, {
          extra: { scene: 'Perps Pro open order edit preference read' },
        });
      }
      if (
        sessionRef.current !== session ||
        pendingRef.current ||
        !isSamePerpsActionAccount(
          perpsStore.getState().currentPerpsAccount,
          editorSnapshot.account,
        )
      ) {
        return;
      }
      setSkipConfirmation(skip);
      if (skip) await execute(editorSnapshot, nextReview);
      else setReview(nextReview);
    },
    [execute],
  );

  const requestBasicReview = useCallback(
    async (draft: PerpsProBasicOrderEditDraft) => {
      if (
        !editor ||
        editor.category !== 'basic' ||
        !editor.order.executionPrice ||
        !editor.order.tif ||
        pendingRef.current ||
        reviewRequestRef.current
      ) {
        return;
      }
      reviewRequestRef.current = true;
      try {
        const baseSize = resolveBasicOrderEditBaseSize({
          amountUnit: editor.amountUnit,
          draft,
          remainingSize: editor.order.remainingSize,
          szDecimals: editor.market.szDecimals,
        });
        if (!baseSize) throw new Error('Invalid edit amount');
        const command = buildPerpsModifyOpenOrderCommand({
          account: editor.account,
          baseSize,
          coin: editor.order.coin,
          dexId: editor.market.dexId,
          expectedLimitPrice: editor.order.executionPrice,
          expectedRemainingSize: editor.order.remainingSize,
          limitPrice: draft.price,
          marketKey: editor.market.marketKey,
          oid: editor.order.oid,
          pxDecimals: editor.market.pxDecimals,
          reduceOnly: editor.order.reduceOnly,
          side: editor.order.side,
          szDecimals: editor.market.szDecimals,
          tif: editor.order.tif as 'Alo' | 'Gtc',
        });
        if (
          new BigNumber(command.replacement.limitPrice).eq(
            command.expected.limitPrice,
          ) &&
          new BigNumber(command.replacement.baseSize).eq(
            command.expected.remainingSize,
          )
        ) {
          throw new Error('Open order edit is unchanged');
        }
        await stageReview(editor, { category: 'basic', command });
      } catch (error) {
        const message = getErrorMessage(error);
        showToast(
          message === 'Invalid edit amount'
            ? t('page.perps.pro.trade.tpSlError.invalidOrderAmount')
            : message === 'Open order edit is unchanged' ||
              message === 'Invalid open order modification'
            ? t('page.perps.pro.openOrders.invalidEdit')
            : message || t('page.perps.pro.openOrders.invalidEdit'),
          'error',
        );
      } finally {
        reviewRequestRef.current = false;
      }
    },
    [editor, stageReview, t],
  );

  const requestConditionalReview = useCallback(
    async (draft: PerpsProConditionalOrderEditDraft) => {
      if (
        !editor ||
        editor.category !== 'conditional' ||
        !editor.order.triggerKind ||
        !editor.order.triggerPrice ||
        pendingRef.current ||
        reviewRequestRef.current
      ) {
        return;
      }
      const state = perpsStore.getState();
      const market = state.marketDataMap[editor.order.coin];
      const livePosition = getLivePosition(editor.order.coin);
      if (
        !isSamePerpsActionAccount(state.currentPerpsAccount, editor.account) ||
        !market?.markPx ||
        !livePosition ||
        livePosition.direction !== editor.position.direction
      ) {
        showToast(t('page.perps.pro.openOrders.editContextChanged'), 'error');
        finish();
        return;
      }
      reviewRequestRef.current = true;
      try {
        const command = buildPerpsPositionTpSlCommand({
          account: editor.account,
          coin: editor.order.coin,
          direction: livePosition.direction,
          expectedPositionSize: livePosition.size,
          legs: [
            {
              expectedOrder: {
                execution: 'market',
                remainingSize: editor.order.remainingSize,
                side: editor.order.side === 'buy' ? 'B' : 'A',
                triggerPrice: editor.order.triggerPrice,
              },
              kind: editor.order.triggerKind,
              replaceOid: editor.order.oid,
              size: draft.baseSize,
              triggerPrice: draft.triggerPrice,
            },
          ],
          markPrice: market.markPx,
          pxDecimals: market.pxDecimals,
          scope: 'partial',
          szDecimals: market.szDecimals,
        });
        const leg = command.legs[0]!;
        if (
          new BigNumber(leg.triggerPrice).eq(editor.order.triggerPrice) &&
          new BigNumber(leg.size || Number.NaN).eq(editor.order.remainingSize)
        ) {
          throw new Error('Conditional edit is unchanged');
        }
        await stageReview(editor, {
          category: 'conditional',
          command,
          markPrice: market.markPx,
        });
      } catch {
        showToast(t('page.perps.pro.openOrders.invalidEdit'), 'error');
      } finally {
        reviewRequestRef.current = false;
      }
    },
    [editor, finish, stageReview, t],
  );

  const confirm = useCallback(async () => {
    if (!editor || !review || pendingRef.current) return;
    if (skipConfirmation) {
      perpsServiceApi
        .setSkipPerpsProOpenOrderEditConfirmation(review.category, true)
        .catch(error => {
          Sentry.captureException(error, {
            extra: { scene: 'Perps Pro open order edit preference write' },
          });
        });
    }
    await execute(editor, review);
  }, [editor, execute, review, skipConfirmation]);

  const toggleSkipConfirmation = useCallback(() => {
    if (!pendingRef.current) {
      setSkipConfirmation(current => !current);
    }
  }, []);

  return {
    close,
    closeReview,
    confirm,
    editor,
    open,
    pending,
    requestBasicReview,
    requestConditionalReview,
    review,
    skipConfirmation,
    toggleSkipConfirmation,
  };
};
