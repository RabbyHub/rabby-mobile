import type { Account } from '@/core/startupServices/preference';
import { apisPerps } from '@/core/apis/perps';
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
  judgeIsBuilderFeeNeedApprove,
  judgeIsUserAgentIsExpired,
} from '@/hooks/perps/perpsActionError';
import { showToast } from '@/hooks/perps/showToast';
import { perpsStore } from '@/hooks/perps/usePerpsStore';
import * as Sentry from '@sentry/react-native';
import type { OpenOrder } from '@rabby-wallet/hyperliquid-sdk';
import BigNumber from 'bignumber.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { buildPerpsProMarketDescriptor } from '../model/market';
import {
  buildPerpsOpenOrderViewModel,
  type PerpsOpenOrderViewModel,
} from '../model/openOrder';
import {
  resolveBasicOrderEditBaseSize,
  type PerpsProBasicOrderEditDraft,
  type PerpsProConditionalOrderEditDraft,
  type PerpsProOpenOrderEditMarketSnapshot,
} from '../model/openOrderEdit';
import type { PerpsPositionViewModel } from '../model/position';
import type { PerpsProTradeAmountUnit } from '../model/trade';
import { getPerpsProOrderErrorText } from '../utils/orderError';

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
      position: PerpsPositionViewModel | null;
    });

export type PerpsProOpenOrderEditReviewState =
  | {
      category: 'basic';
      command: PerpsModifyOpenOrderCommand;
    }
  | {
      category: 'conditional';
      command: PerpsModifyOpenOrderCommand;
      referencePrice: string;
    };

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error || '');

const getOrderIdentity = (
  order: Pick<PerpsOpenOrderViewModel, 'coin' | 'oid'>,
) => `${order.coin}\u0000${order.oid}`;

const buildEditorState = ({
  account,
  amountUnit,
  market,
  order,
  position,
}: CommonEditorState & { position?: PerpsPositionViewModel | null }) => {
  if (order.editKind === 'limit' && order.executionPrice) {
    return {
      account: { ...account },
      amountUnit,
      category: 'basic' as const,
      market,
      order: { ...order },
    };
  }
  if (order.editKind && order.editKind !== 'limit') {
    return {
      account: { ...account },
      amountUnit,
      category: 'conditional' as const,
      market,
      order: { ...order },
      position: position ? { ...position } : null,
    };
  }
  return null;
};

export const usePerpsProOpenOrderEdit = (
  accountIdentity: string,
  tradeAmountUnit: PerpsProTradeAmountUnit,
) => {
  const { t } = useTranslation();
  const sessionRef = useRef(0);
  const openRequestRef = useRef(false);
  const pendingRef = useRef(false);
  const reviewRequestRef = useRef(false);
  const [editor, setEditor] = useState<PerpsProOpenOrderEditEditorState | null>(
    null,
  );
  const [review, setReview] = useState<PerpsProOpenOrderEditReviewState | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const [reviewRequesting, setReviewRequesting] = useState(false);
  const [skipConfirmation, setSkipConfirmation] = useState(false);
  const [unavailableOrderKeys, setUnavailableOrderKeys] = useState<
    ReadonlySet<string>
  >(() => new Set());

  useEffect(() => {
    sessionRef.current += 1;
    openRequestRef.current = false;
    pendingRef.current = false;
    reviewRequestRef.current = false;
    setEditor(null);
    setReview(null);
    setPending(false);
    setReviewRequesting(false);
    setSkipConfirmation(false);
    setUnavailableOrderKeys(new Set());
    return () => {
      sessionRef.current += 1;
      openRequestRef.current = false;
      reviewRequestRef.current = false;
    };
  }, [accountIdentity]);

  const markUnavailable = useCallback((order: PerpsOpenOrderViewModel) => {
    const identity = getOrderIdentity(order);
    setUnavailableOrderKeys(current => {
      if (current.has(identity)) return current;
      const next = new Set(current);
      next.add(identity);
      return next;
    });
  }, []);

  const isEditUnavailable = useCallback(
    (order: PerpsOpenOrderViewModel) =>
      unavailableOrderKeys.has(getOrderIdentity(order)),
    [unavailableOrderKeys],
  );

  const open = useCallback(
    async (
      order: PerpsOpenOrderViewModel,
      position?: PerpsPositionViewModel | null,
    ) => {
      if (
        pendingRef.current ||
        openRequestRef.current ||
        !order.editKind ||
        isEditUnavailable(order)
      ) {
        return;
      }
      const state = perpsStore.getState();
      const account = state.currentPerpsAccount;
      const marketData = state.marketDataMap[order.coin];
      if (!account || !marketData) {
        showToast(t('page.perps.pro.openOrders.editUnavailable'), 'error');
        return;
      }
      const session = sessionRef.current;
      openRequestRef.current = true;
      let verifiedOrder = order;
      try {
        const status = await apisPerps
          .getPerpsSDK()
          .info.getOrderStatus(order.oid, account.address);
        if (
          sessionRef.current !== session ||
          !isSamePerpsActionAccount(
            perpsStore.getState().currentPerpsAccount,
            account,
          )
        ) {
          return;
        }
        if (status.status === 'order') {
          if (status.order.status !== 'open') {
            markUnavailable(order);
            showToast(t('page.perps.pro.openOrders.editOrderClosed'), 'error');
            return;
          }
          verifiedOrder = buildPerpsOpenOrderViewModel(
            status.order.order as OpenOrder,
          );
        }
        if (getOrderIdentity(order) !== getOrderIdentity(verifiedOrder)) {
          showToast(t('page.perps.pro.openOrders.editContextChanged'), 'error');
          return;
        }
      } catch {
        // Public orderStatus is a best-effort preflight. A transport failure is
        // not proof that the Store order is stale, so final submit remains
        // available to the authenticated modify endpoint.
      } finally {
        openRequestRef.current = false;
      }
      if (!verifiedOrder.editKind) {
        markUnavailable(order);
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
      const next = buildEditorState({
        account,
        amountUnit: tradeAmountUnit,
        market,
        order: verifiedOrder,
        position,
      });
      if (!next) {
        showToast(t('page.perps.pro.openOrders.editUnavailable'), 'error');
        return;
      }
      sessionRef.current += 1;
      reviewRequestRef.current = false;
      setReviewRequesting(false);
      setSkipConfirmation(false);
      setReview(null);
      setEditor(next);
    },
    [isEditUnavailable, markUnavailable, t, tradeAmountUnit],
  );

  const close = useCallback(() => {
    if (!pendingRef.current && !reviewRequestRef.current && !review) {
      sessionRef.current += 1;
      setReviewRequesting(false);
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
    reviewRequestRef.current = false;
    setReviewRequesting(false);
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
          if (result.staleReason === 'orderClosed') {
            markUnavailable(editorSnapshot.order);
            showToast(t('page.perps.pro.openOrders.editOrderClosed'), 'error');
            finish();
            return;
          }
          if (result.staleReason === 'orderChanged') {
            const latestOrder = buildPerpsOpenOrderViewModel(
              result.latestOrder,
            );
            const nextEditor =
              getOrderIdentity(latestOrder) ===
              getOrderIdentity(editorSnapshot.order)
                ? buildEditorState({
                    account: editorSnapshot.account,
                    amountUnit: editorSnapshot.amountUnit,
                    market: editorSnapshot.market,
                    order: latestOrder,
                    position:
                      editorSnapshot.category === 'conditional'
                        ? editorSnapshot.position
                        : null,
                  })
                : null;
            if (nextEditor) {
              setSkipConfirmation(false);
              setReview(null);
              setEditor(nextEditor);
              showToast(
                t('page.perps.pro.openOrders.editOrderChanged'),
                'error',
              );
              return;
            }
            markUnavailable(editorSnapshot.order);
            showToast(t('page.perps.pro.openOrders.editUnavailable'), 'error');
            finish();
            return;
          }
          showToast(t('page.perps.pro.openOrders.editContextChanged'), 'error');
          finish();
          return;
        }
        if (result.refreshError) {
          Sentry.captureException(
            new Error(`Open order edit refresh failed: ${result.refreshError}`),
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
          getPerpsProOrderErrorText({
            message: result.error || t('page.perps.pro.openOrders.editFailed'),
            side: reviewSnapshot.command.expected.side,
            t,
          }),
          'error',
        );
        setReview(null);
      } catch (error) {
        if (isPerpsActionUserCancelled(error)) return;
        const message = getErrorMessage(error);
        if (await handleKnownActionError(message)) return;
        showToast(
          getPerpsProOrderErrorText({
            message: message || t('page.perps.pro.openOrders.editFailed'),
            side: editorSnapshot.order.side,
            t,
          }),
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
    [finish, handleKnownActionError, markUnavailable, t],
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
      const session = sessionRef.current;
      reviewRequestRef.current = true;
      setReviewRequesting(true);
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
          cloid: editor.order.cloid,
          coin: editor.order.coin,
          dexId: editor.market.dexId,
          editKind: 'limit',
          expectedIsPositionTpsl: editor.order.isPositionTpsl,
          expectedLimitPrice: editor.order.executionPrice,
          expectedOrderType: editor.order.orderType,
          expectedRemainingSize: editor.order.remainingSize,
          limitPrice: draft.price,
          marketKey: editor.market.marketKey,
          oid: editor.order.oid,
          pxDecimals: editor.market.pxDecimals,
          reduceOnly: editor.order.reduceOnly,
          side: editor.order.side,
          szDecimals: editor.market.szDecimals,
          tif: editor.order.tif as 'Alo' | 'Gtc' | 'Ioc',
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
        if (sessionRef.current === session) {
          reviewRequestRef.current = false;
          setReviewRequesting(false);
        }
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
        !editor.order.limitPrice ||
        (editor.order.editKind !== 'triggerMarket' &&
          editor.order.editKind !== 'triggerLimit') ||
        pendingRef.current ||
        reviewRequestRef.current
      ) {
        return;
      }
      const session = sessionRef.current;
      reviewRequestRef.current = true;
      setReviewRequesting(true);
      try {
        const command = buildPerpsModifyOpenOrderCommand({
          account: editor.account,
          baseSize: draft.baseSize,
          cloid: editor.order.cloid,
          coin: editor.order.coin,
          dexId: editor.market.dexId,
          editKind: editor.order.editKind,
          expectedIsPositionTpsl: editor.order.isPositionTpsl,
          expectedLimitPrice: editor.order.limitPrice,
          expectedOrderType: editor.order.orderType,
          expectedRemainingSize: editor.order.remainingSize,
          expectedTriggerPrice: editor.order.triggerPrice,
          limitPrice: draft.limitPrice || undefined,
          marketKey: editor.market.marketKey,
          oid: editor.order.oid,
          pxDecimals: editor.market.pxDecimals,
          reduceOnly: editor.order.reduceOnly,
          side: editor.order.side,
          szDecimals: editor.market.szDecimals,
          triggerKind: editor.order.triggerKind,
          triggerPrice: draft.triggerPrice,
        });
        const triggerUnchanged = new BigNumber(
          command.replacement.triggerPrice || Number.NaN,
        ).eq(editor.order.triggerPrice);
        const amountUnchanged = new BigNumber(command.replacement.baseSize).eq(
          editor.order.remainingSize,
        );
        const limitUnchanged =
          editor.order.editKind === 'triggerMarket' ||
          new BigNumber(command.replacement.limitPrice).eq(
            editor.order.limitPrice,
          );
        if (triggerUnchanged && amountUnchanged && limitUnchanged) {
          throw new Error('Conditional edit is unchanged');
        }
        await stageReview(editor, {
          category: 'conditional',
          command,
          referencePrice:
            editor.order.editKind === 'triggerLimit'
              ? command.replacement.limitPrice
              : editor.market.markPrice ||
                command.replacement.triggerPrice ||
                command.replacement.limitPrice,
        });
      } catch (error) {
        const message = getErrorMessage(error);
        showToast(
          message === 'Conditional edit is unchanged' ||
            message === 'Invalid open order modification'
            ? t('page.perps.pro.openOrders.invalidEdit')
            : message || t('page.perps.pro.openOrders.invalidEdit'),
          'error',
        );
      } finally {
        if (sessionRef.current === session) {
          reviewRequestRef.current = false;
          setReviewRequesting(false);
        }
      }
    },
    [editor, stageReview, t],
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
    isEditUnavailable,
    open,
    pending,
    requestBasicReview,
    requestConditionalReview,
    review,
    reviewRequesting,
    skipConfirmation,
    toggleSkipConfirmation,
  };
};
