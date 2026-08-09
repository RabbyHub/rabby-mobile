import type { L2Book, WsActiveAssetData } from '@rabby-wallet/hyperliquid-sdk';
import { useCallback, useEffect, useRef } from 'react';

import { perpsServiceApi } from '@/core/serviceApi/perps';
import { isSamePerpsActionAccount } from '@/hooks/perps/actions/accountGuard';
import { isPerpsActionUserCancelled } from '@/hooks/perps/actions/actionError';
import { ensurePerpsActionApproval } from '@/hooks/perps/actions/perpsActionApproval';
import { getPerpsRuntimeSnapshot } from '@/hooks/perps/runtime/perpsRuntimeState';
import {
  fetchClearinghouseStateHttp,
  fetchPositionOpenOrdersHttp,
  getPerpsAccountRuntimeContext,
  perpsStore,
} from '@/hooks/perps/usePerpsStore';
import { calLiquidationPrice } from '@/utils/perps';

import type { PerpsAttachedTpSlJournalEntry } from '@/core/services/perpsService';
import { estimatePerpsProMarketFill } from '../model/marketFillEstimate';
import type { PerpsProMarket } from '../model/market';
import { resolvePerpsProProjectedTradeRisk } from '../model/tradeRisk';
import {
  executePerpsProAttachedTpSl,
  getPerpsProAttachedTpSlPositionIdentity,
  validatePerpsProAttachedTpSlCommand,
  type PerpsProAttachedTpSlCommand,
  type PerpsProAttachedTpSlGuardContext,
  type PerpsProAttachedTpSlResult,
} from '../actions/openOrderWithAttachedTpSl';
import { reconcilePerpsProAttachedTpSl } from '../actions/reconcileAttachedTpSl';

export type PerpsProAttachedTpSlFinalOutcome = {
  error?: string;
  kind: PerpsProAttachedTpSlResult['kind'];
  reconciliationErrors: string[];
  refreshErrors: string[];
  reason?: 'unresolvedSubmission';
};

export type EnsurePerpsProAttachedTpSlLeverage = (
  command: PerpsProAttachedTpSlCommand,
) => Promise<'failed' | 'staleContext' | 'success' | 'userCancelled'>;

const reconciliationOutcome = (
  entry: PerpsAttachedTpSlJournalEntry,
  kind: Awaited<ReturnType<typeof reconcilePerpsProAttachedTpSl>>['kind'],
  legs: PerpsAttachedTpSlJournalEntry['legs'],
): PerpsAttachedTpSlJournalEntry => ({
  ...entry,
  legs,
  outcome:
    kind === 'fullAccepted'
      ? 'fullAccepted'
      : kind === 'childRejected'
      ? 'childRejected'
      : kind === 'partialOutcome'
      ? 'partial'
      : 'unknown',
  updatedAt: Date.now(),
});

export const usePerpsProAttachedTpSlExecution = ({
  active,
  activeAssetData,
  bboBook,
  bboSessionKey,
  bboStatus,
  market,
  refreshActiveAssetData,
}: {
  active: boolean;
  activeAssetData: WsActiveAssetData | null;
  bboBook: L2Book | null;
  bboSessionKey: string | null;
  bboStatus: 'error' | 'idle' | 'loading' | 'ready' | 'stale';
  market: PerpsProMarket | null;
  refreshActiveAssetData: () => Promise<unknown>;
}) => {
  const latestRef = useRef({
    active,
    activeAssetData,
    bboBook,
    bboSessionKey,
    bboStatus,
    market,
  });
  latestRef.current = {
    active,
    activeAssetData,
    bboBook,
    bboSessionKey,
    bboStatus,
    market,
  };
  const recoveryInFlightRef = useRef<Promise<void> | null>(null);

  const getGuardContext = useCallback(
    (
      command: PerpsProAttachedTpSlCommand,
    ): PerpsProAttachedTpSlGuardContext => {
      const latest = latestRef.current;
      const state = perpsStore.getState();
      const marketData = state.marketDataMap[command.parent.coin];
      const currentPosition =
        state.currentClearinghouseState?.assetPositions.find(
          item => item.position.coin === command.parent.coin,
        )?.position ?? null;
      let entryPrice: string | null =
        command.parent.execution.kind === 'limit'
          ? command.parent.execution.limitPrice
          : null;
      if (command.parent.execution.kind === 'market') {
        const estimate = estimatePerpsProMarketFill({
          amount: command.parent.baseSize,
          amountUnit: 'base',
          book: latest.bboBook,
          coin: command.parent.coin,
          sessionKey: latest.bboSessionKey,
          side: command.parent.side,
          status: latest.bboStatus,
          szDecimals: command.reviewFacts.szDecimals,
        });
        entryPrice = estimate.ok ? estimate.estimate.expectedEntryPrice : null;
      }
      const risk =
        entryPrice && marketData
          ? resolvePerpsProProjectedTradeRisk({
              baseSize: command.parent.baseSize,
              calculateLiquidationPrice: calLiquidationPrice,
              crossMarginAccountValue:
                state.currentClearinghouseState?.crossMarginSummary
                  .accountValue ?? '0',
              crossMaintenanceMarginUsed:
                state.currentClearinghouseState?.crossMaintenanceMarginUsed ??
                '0',
              currentPosition,
              entryPrice,
              leverage: command.reviewFacts.leverage,
              marginMode: command.reviewFacts.marginMode,
              markPrice: marketData.markPx,
              maxLeverage: marketData.maxLeverage,
              pxDecimals: marketData.pxDecimals,
              side: command.parent.side,
            })
          : null;
      return {
        accountRuntime: getPerpsAccountRuntimeContext(),
        active: latest.active,
        book: latest.bboBook,
        bookSessionKey: latest.bboSessionKey,
        bookStatus: latest.bboStatus,
        coin: latest.market?.canonicalCoin ?? '',
        dexId: latest.market?.marketData.dexId ?? '',
        liquidationPrice: risk?.liquidationPrice ?? null,
        marketKey: latest.market?.marketKey ?? null,
        maxBaseSize:
          latest.activeAssetData?.maxTradeSzs[
            command.parent.side === 'buy' ? 0 : 1
          ] ?? null,
        positionIdentity:
          getPerpsProAttachedTpSlPositionIdentity(currentPosition),
        runtime: getPerpsRuntimeSnapshot(),
      };
    },
    [],
  );

  const refreshCurrentAccount = useCallback(
    async (entry: PerpsAttachedTpSlJournalEntry) => {
      const account = perpsStore.getState().currentPerpsAccount;
      if (
        !account ||
        account.address.toLowerCase() !== entry.accountAddress.toLowerCase() ||
        String(account.type) !== entry.accountType
      ) {
        return [];
      }
      const errors: string[] = [];
      const results = await Promise.allSettled([
        fetchPositionOpenOrdersHttp(entry.dexId),
        fetchClearinghouseStateHttp(entry.dexId),
        latestRef.current.market?.canonicalCoin === entry.coin
          ? refreshActiveAssetData()
          : Promise.resolve(),
      ]);
      results.forEach(result => {
        if (result.status === 'rejected') errors.push(String(result.reason));
      });
      return errors;
    },
    [refreshActiveAssetData],
  );

  const reconcileEntry = useCallback(
    async (
      entry: PerpsAttachedTpSlJournalEntry,
      authoritativeKind?: PerpsProAttachedTpSlResult['kind'],
    ) => {
      const reconciliation = await reconcilePerpsProAttachedTpSl(entry);
      const finalKind =
        authoritativeKind === 'fullAccepted' ||
        authoritativeKind === 'childRejected'
          ? authoritativeKind
          : reconciliation.kind;
      if (finalKind === 'fullAccepted' || finalKind === 'parentRejected') {
        await perpsServiceApi.removePerpsAttachedTpSlJournalEntry(
          entry.commandId,
        );
      } else {
        await perpsServiceApi.upsertPerpsAttachedTpSlJournalEntry(
          reconciliationOutcome(entry, finalKind, reconciliation.legs),
        );
      }
      const refreshErrors = await refreshCurrentAccount(entry);
      return {
        finalKind,
        reconciliationErrors: reconciliation.errors,
        refreshErrors,
      };
    },
    [refreshCurrentAccount],
  );

  const recoverJournal = useCallback(async () => {
    if (recoveryInFlightRef.current) return recoveryInFlightRef.current;
    const recovery = (async () => {
      let entries: PerpsAttachedTpSlJournalEntry[];
      try {
        entries = await perpsServiceApi.getPerpsAttachedTpSlJournal();
      } catch {
        return;
      }
      for (const entry of entries) {
        await reconcileEntry(
          entry,
          entry.outcome === 'fullAccepted'
            ? 'fullAccepted'
            : entry.outcome === 'childRejected'
            ? 'childRejected'
            : undefined,
        ).catch(() => undefined);
      }
    })().finally(() => {
      if (recoveryInFlightRef.current === recovery) {
        recoveryInFlightRef.current = null;
      }
    });
    recoveryInFlightRef.current = recovery;
    return recovery;
  }, [reconcileEntry]);

  useEffect(() => {
    if (active) void recoverJournal();
  }, [active, recoverJournal]);

  const execute = useCallback(
    async (
      command: PerpsProAttachedTpSlCommand,
      ensureLeverage: EnsurePerpsProAttachedTpSlLeverage,
    ): Promise<PerpsProAttachedTpSlFinalOutcome> => {
      const empty = { reconciliationErrors: [], refreshErrors: [] };
      const guard = () =>
        validatePerpsProAttachedTpSlCommand(command, getGuardContext(command));
      if (!guard().ok) return { ...empty, kind: 'staleContext' };
      try {
        const account = getPerpsAccountRuntimeContext().account;
        if (
          !account ||
          !isSamePerpsActionAccount(account, command.parent.account)
        ) {
          return { ...empty, kind: 'staleContext' };
        }
        await ensurePerpsActionApproval(account);
        if (!guard().ok) return { ...empty, kind: 'staleContext' };
        const leverageResult = await ensureLeverage(command);
        if (leverageResult !== 'success') {
          return {
            ...empty,
            kind:
              leverageResult === 'userCancelled'
                ? 'userCancelled'
                : leverageResult === 'staleContext'
                ? 'staleContext'
                : 'requestFailed',
          };
        }
        if (!guard().ok) return { ...empty, kind: 'staleContext' };
        const result = await executePerpsProAttachedTpSl(command, () =>
          getGuardContext(command),
        );
        if (
          result.kind !== 'fullAccepted' &&
          result.kind !== 'childRejected' &&
          result.kind !== 'partialOutcome' &&
          result.kind !== 'unknownOutcome'
        ) {
          return {
            ...empty,
            error: 'error' in result ? result.error : undefined,
            kind: result.kind,
            reason: result.kind === 'requestFailed' ? result.reason : undefined,
          };
        }
        const entry = (
          await perpsServiceApi.getPerpsAttachedTpSlJournal()
        ).find(item => item.commandId === command.commandId);
        if (!entry) {
          return { ...empty, kind: result.kind };
        }
        const reconciled = await reconcileEntry(entry, result.kind);
        return {
          error: 'error' in result ? result.error : undefined,
          kind: reconciled.finalKind,
          reconciliationErrors: reconciled.reconciliationErrors,
          refreshErrors: reconciled.refreshErrors,
        } as PerpsProAttachedTpSlFinalOutcome;
      } catch (error) {
        if (isPerpsActionUserCancelled(error)) {
          return { ...empty, kind: 'userCancelled' };
        }
        return {
          ...empty,
          error: error instanceof Error ? error.message : String(error),
          kind: 'requestFailed',
        };
      }
    },
    [getGuardContext, reconcileEntry],
  );

  return { execute, recoverJournal };
};
