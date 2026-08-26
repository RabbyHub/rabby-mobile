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

import type { PerpsAttachedTpSlJournalEntry } from '@/core/services/perpsService';
import type { PerpsProMarket } from '../model/market';
import {
  executePerpsProAttachedTpSl,
  getPerpsProAttachedTpSlBatchError,
  validatePerpsProAttachedTpSlCommand,
  type PerpsProAttachedTpSlCommand,
  type PerpsProAttachedTpSlGuardContext,
  type PerpsProAttachedTpSlGuardFailureReason,
  type PerpsProAttachedTpSlResult,
} from '../actions/openOrderWithAttachedTpSl';
import { reconcilePerpsProAttachedTpSl } from '../actions/reconcileAttachedTpSl';

export type PerpsProAttachedTpSlFinalOutcome = {
  error?: string;
  kind: PerpsProAttachedTpSlResult['kind'];
  leg?: 'sl' | 'tp';
  reconciliationErrors: string[];
  refreshErrors: string[];
  reason?: PerpsProAttachedTpSlGuardFailureReason | 'unresolvedSubmission';
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

const PARENT_ROLE = new Set(['parent'] as const);
const CHILD_ROLES = new Set(['stopLoss', 'takeProfit'] as const);

const getResultServerError = (result: PerpsProAttachedTpSlResult) => {
  if (!('batch' in result)) return undefined;
  if (result.kind === 'parentRejected') {
    return getPerpsProAttachedTpSlBatchError(result.batch, PARENT_ROLE);
  }
  if (result.kind === 'childRejected') {
    return getPerpsProAttachedTpSlBatchError(result.batch, CHILD_ROLES);
  }
  return getPerpsProAttachedTpSlBatchError(result.batch);
};

export const usePerpsProAttachedTpSlExecution = ({
  active,
  market,
  refreshActiveAssetData,
}: {
  active: boolean;
  market: PerpsProMarket | null;
  refreshActiveAssetData: () => Promise<unknown>;
}) => {
  const latestRef = useRef({
    active,
    market,
  });
  latestRef.current = {
    active,
    market,
  };
  const recoveryInFlightRef = useRef<Promise<void> | null>(null);

  const getGuardContext = useCallback((): PerpsProAttachedTpSlGuardContext => {
    const latest = latestRef.current;
    const state = perpsStore.getState();
    return {
      accountRuntime: getPerpsAccountRuntimeContext(),
      active: latest.active,
      coin: latest.market?.canonicalCoin ?? '',
      dexId: latest.market?.marketData.dexId ?? '',
      hasPermission: state.hasPermission,
      marketKey: latest.market?.marketKey ?? null,
      runtime: getPerpsRuntimeSnapshot(),
    };
  }, []);

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
        validatePerpsProAttachedTpSlCommand(command, getGuardContext());
      const guardFailure = () => {
        const result = guard();
        return result.ok
          ? null
          : {
              ...empty,
              kind: 'staleContext' as const,
              leg: result.leg,
              reason: result.reason,
            };
      };
      const initialGuardFailure = guardFailure();
      if (initialGuardFailure) return initialGuardFailure;
      try {
        const account = getPerpsAccountRuntimeContext().account;
        if (
          !account ||
          !isSamePerpsActionAccount(account, command.parent.account)
        ) {
          return { ...empty, kind: 'staleContext' };
        }
        await ensurePerpsActionApproval(account);
        const postApprovalGuardFailure = guardFailure();
        if (postApprovalGuardFailure) return postApprovalGuardFailure;
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
        const postLeverageGuardFailure = guardFailure();
        if (postLeverageGuardFailure) return postLeverageGuardFailure;
        const result = await executePerpsProAttachedTpSl(
          command,
          getGuardContext,
        );
        const serverError = getResultServerError(result);
        if (
          result.kind !== 'fullAccepted' &&
          result.kind !== 'childRejected' &&
          result.kind !== 'partialOutcome' &&
          result.kind !== 'unknownOutcome'
        ) {
          return {
            ...empty,
            error:
              ('error' in result ? result.error : undefined) ?? serverError,
            kind: result.kind,
            leg: result.kind === 'staleContext' ? result.leg : undefined,
            reason:
              result.kind === 'requestFailed' || result.kind === 'staleContext'
                ? result.reason
                : undefined,
          };
        }
        const entry = (
          await perpsServiceApi.getPerpsAttachedTpSlJournal()
        ).find(item => item.commandId === command.commandId);
        if (!entry) {
          return { ...empty, error: serverError, kind: result.kind };
        }
        const reconciled = await reconcileEntry(entry, result.kind);
        return {
          error: ('error' in result ? result.error : undefined) ?? serverError,
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
