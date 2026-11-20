import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apisPerps } from '@/core/apis/perps';
import { isUnlocked } from '@/core/apis/lock';
import { ensureWalletUnlockedForAction } from '@/utils/walletUnlock';
import { ensurePerpsActionApproval } from '@/hooks/perps/actions/perpsActionApproval';
import { isPerpsActionUserCancelled } from '@/hooks/perps/actions/actionError';
import { getPerpsRuntimeSnapshot } from '@/hooks/perps/runtime/perpsRuntimeState';
import {
  getPerpsAccountRuntimeContext,
  hasCurrentPerpPermission,
  perpsStore,
} from '@/hooks/perps/usePerpsStore';
import {
  getPerpsTwapAccount,
  queuePerpsTwapReceipt,
} from '@/hooks/perps/twap/usePerpsTwapStore';
import { refreshPerpsTwaps } from '@/hooks/perps/twap/usePerpsTwapSubscriptions';
import type { PerpsTwapRecord } from '@/hooks/perps/twap/types';
import { showToast } from '@/hooks/perps/showToast';
import {
  buildPerpsProCancelTwapCommand,
  executePerpsProCancelTwap,
  isPerpsProCancelTwapContextCurrent,
  type PerpsProCancelTwapCommand,
} from '../actions/cancelTwap';
import { isSamePerpsActionAccount } from '@/hooks/perps/actions/accountGuard';

export const usePerpsProCancelTwap = (
  accountIdentity: string,
  active: boolean,
) => {
  const { t } = useTranslation();
  const [command, setCommand] = useState<PerpsProCancelTwapCommand | null>(
    null,
  );
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const preparationEpoch = useRef(0);
  const live = useRef(active);
  live.current = active;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      live.current = false;
    };
  }, []);
  useEffect(() => {
    preparationEpoch.current++;
    setCommand(null);
  }, [accountIdentity, active]);
  const close = useCallback(() => {
    if (!busy.current) setCommand(null);
  }, []);
  const request = useCallback(
    async (order: PerpsTwapRecord) => {
      if (busy.current || !live.current) return;
      const prepared = buildPerpsProCancelTwapCommand(
        order,
        getPerpsAccountRuntimeContext(),
        getPerpsRuntimeSnapshot(),
      );
      if (!prepared) {
        showToast(t('page.perps.pro.twap.errors.contextChanged'), 'error');
        return;
      }
      const epoch = preparationEpoch.current;
      const isCurrentScene = () =>
        mounted.current && live.current && preparationEpoch.current === epoch;
      busy.current = true;
      try {
        // Password UI belongs to the app host, below native Modals. Complete
        // unlock before presenting this scene's End confirmation.
        if (!(await ensureWalletUnlockedForAction()) || !isCurrentScene())
          return;
        const data = getPerpsTwapAccount(prepared.account.address);
        const accountRuntime = getPerpsAccountRuntimeContext();
        const runtime = getPerpsRuntimeSnapshot();
        const latest = data.records[prepared.key] ?? null;
        if (
          isPerpsProCancelTwapContextCurrent(prepared, {
            accountRuntime,
            runtime,
            activeReady: data.sources.active.ready,
            order: latest,
            // Approval is still performed on confirmation.
            hasPermission: isUnlocked(),
          }) &&
          latest
        ) {
          setCommand(
            buildPerpsProCancelTwapCommand(latest, accountRuntime, runtime),
          );
        } else {
          showToast(t('page.perps.pro.twap.errors.contextChanged'), 'error');
        }
      } catch (error) {
        if (isCurrentScene() && !isPerpsActionUserCancelled(error))
          showToast(
            error instanceof Error ? error.message : String(error),
            'error',
          );
      } finally {
        busy.current = false;
      }
    },
    [t],
  );
  const confirm = useCallback(async () => {
    if (!command || busy.current || !live.current) return;
    const frozen = command;
    const account = perpsStore.getState().currentPerpsAccount;
    if (!account || !isSamePerpsActionAccount(account, frozen.account)) {
      setCommand(null);
      return;
    }
    busy.current = true;
    setPending(true);
    const getContext = () => {
      const data = getPerpsTwapAccount(frozen.account.address);
      return {
        accountRuntime: getPerpsAccountRuntimeContext(),
        runtime: getPerpsRuntimeSnapshot(),
        hasPermission:
          live.current && isUnlocked() && hasCurrentPerpPermission(),
        activeReady: data.sources.active.ready,
        order: data.records[frozen.key] ?? null,
      };
    };
    try {
      // A relock or changed order invalidates the confirmation; do not open
      // another password prompt underneath it.
      if (
        !isPerpsProCancelTwapContextCurrent(frozen, {
          ...getContext(),
          hasPermission: live.current && isUnlocked(),
        })
      ) {
        showToast(t('page.perps.pro.twap.errors.contextChanged'), 'error');
        return;
      }
      await ensurePerpsActionApproval(account, { builderFee: false });
      const exchange = apisPerps.getPerpsSDK().exchange;
      if (!exchange)
        throw new Error(t('page.perps.pro.twap.errors.contextChanged'));
      const result = await executePerpsProCancelTwap(frozen, {
        getContext,
        submit: (params, options) =>
          exchange.cancelTwapOrderWithOutcome(params, options),
      });
      void refreshPerpsTwaps(frozen.account.address);
      // Keep dispatched outcomes attached to the original account, including after unmount.
      if (
        result.kind === 'cancelled' ||
        result.kind === 'unknownOutcome' ||
        result.kind === 'rejected'
      ) {
        queuePerpsTwapReceipt(frozen.runtimeIdentity, {
          id: `end:${result.evidence.nonce}:${frozen.key}`,
          coin: frozen.coin,
          kind: result.kind,
          ...(result.kind === 'rejected' ? { error: result.error } : {}),
        });
      } else if (
        mounted.current &&
        isSamePerpsActionAccount(
          perpsStore.getState().currentPerpsAccount,
          frozen.account,
        )
      ) {
        if (result.kind === 'requestFailed') showToast(result.error, 'error');
        else if (result.kind === 'contextChanged')
          showToast(t('page.perps.pro.twap.errors.contextChanged'), 'error');
      }
    } catch (error) {
      if (
        mounted.current &&
        isSamePerpsActionAccount(
          perpsStore.getState().currentPerpsAccount,
          frozen.account,
        ) &&
        !isPerpsActionUserCancelled(error)
      )
        showToast(
          error instanceof Error ? error.message : String(error),
          'error',
        );
    } finally {
      busy.current = false;
      if (mounted.current) {
        setPending(false);
        setCommand(value => (value === frozen ? null : value));
      }
    }
  }, [command, t]);
  return { command, pending, request, close, confirm };
};
